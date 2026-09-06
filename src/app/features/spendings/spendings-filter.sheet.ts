import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Category, Tag } from '../../domain/models/models';
import {
  CategoryPickerData,
  CategoryPickerResult,
  CategoryPickerSheet,
} from '../../shared/ui/category-picker.sheet';
import {
  DATE_INPUT_FORMAT,
  DateInputComponent,
} from '../../shared/ui/date-input.component';
import { IconComponent } from '../../shared/ui/icon.component';
import {
  TagPickerData,
  TagPickerResult,
  TagPickerSheet,
} from '../../shared/ui/tag-picker.sheet';
import { categoryPath } from '../../shared/util/category-tree.util';
import { formatApiDate, parseApiDate } from '../../shared/util/date.util';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';
import { SpendingsFilter } from './spendings.store';

export interface SpendingsFilterData {
  readonly filter: SpendingsFilter;

  /** Размер очереди неразнесённых - счётчик у пункта «без категории». */
  readonly withoutCategoryCount: number;
}

export type SpendingsFilterResult = {
  readonly kind: 'applied';
  readonly filter: SpendingsFilter;
};

/** Выбранная категория или тег: чипсу нужна подпись, фильтру - идентификатор. */
export interface FilterItem {
  readonly id: string;
  readonly title: string;
}

@Component({
  selector: 'app-spendings-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DateInputComponent, IconComponent, SwipeToCloseDirective],
  templateUrl: './spendings-filter.sheet.html',
  styleUrl: './spendings-filter.sheet.scss',
})
export class SpendingsFilterSheet {
  private readonly data = inject<SpendingsFilterData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<SpendingsFilterResult>>(DialogRef);
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);

  protected readonly withoutCategoryCount = this.data.withoutCategoryCount;

  /** Справочники ещё читаются: подписи выбранного до них не собрать. */
  protected readonly isLoading = signal(true);

  protected readonly onlyWithoutCategories = signal(
    this.data.filter.onlyWithoutCategories,
  );

  protected readonly categories = signal<readonly FilterItem[]>([]);
  protected readonly tags = signal<readonly FilterItem[]>([]);

  protected readonly dateFromText = signal(formatOptionalDate(this.data.filter.dateFrom));
  protected readonly dateToText = signal(formatOptionalDate(this.data.filter.dateTo));

  protected readonly dateFromError = computed(() => dateError(this.dateFromText()));
  protected readonly dateToError = computed(() => dateError(this.dateToText()));

  /**
   * Перевёрнутый период - ошибка периода целиком, а не отдельного поля: обе
   * даты по себе верны, неверно их сочетание.
   */
  protected readonly rangeError = computed(() => {
    const from = parseOptionalDate(this.dateFromText());
    const to = parseOptionalDate(this.dateToText());

    return from && to && from > to ? 'Начало периода позже конца' : null;
  });

  protected readonly canApply = computed(
    () =>
      !this.isLoading() &&
      this.dateFromError() === null &&
      this.dateToError() === null &&
      this.rangeError() === null,
  );

  protected readonly isEmpty = computed(
    () =>
      !this.onlyWithoutCategories() &&
      this.categories().length === 0 &&
      this.tags().length === 0 &&
      this.dateFromText().trim() === '' &&
      this.dateToText().trim() === '',
  );

  constructor() {
    this.loadSelection();
  }

  /**
   * Включённое «только без категории» гасит выбор категорий.
   *
   * Условия несовместимы - трата без категории ни в одну выбранную не попадёт,
   * - и сервер такой запрос отвергает. Категории снимаются здесь, а не
   * блокируются: заблокированный список выбранного выглядел бы применённым.
   */
  protected onOnlyWithoutCategories(event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.onlyWithoutCategories.set(value);

    if (value) {
      this.categories.set([]);
    }
  }

  protected addCategory(): void {
    this.sheets
      .openSheet<CategoryPickerResult, CategoryPickerData>(
        CategoryPickerSheet,
        {
          title: 'Категория',
          excludedIds: this.categories().map((item) => item.id),
          // Заводить разметку из фильтра незачем: пустая категория ничего
          // не найдёт.
          allowCreate: false,
        },
        { ariaLabel: 'Выбор категории' },
      )
      .closed.subscribe((result) => {
        if (result?.kind !== 'existing') {
          return;
        }

        this.categories.update((current) => [
          ...current,
          { id: result.category.id, title: result.category.title },
        ]);
      });
  }

  protected addTag(): void {
    this.sheets
      .openSheet<TagPickerResult, TagPickerData>(
        TagPickerSheet,
        { excludedIds: this.tags().map((item) => item.id), allowCreate: false },
        { ariaLabel: 'Выбор тега' },
      )
      .closed.subscribe((result) => {
        if (result?.kind !== 'existing') {
          return;
        }

        this.tags.update((current) => [
          ...current,
          { id: result.tag.id, title: result.tag.title },
        ]);
      });
  }

  protected removeCategory(id: string): void {
    this.categories.update((current) => current.filter((item) => item.id !== id));
  }

  protected removeTag(id: string): void {
    this.tags.update((current) => current.filter((item) => item.id !== id));
  }

  protected onDateFrom(value: string): void {
    this.dateFromText.set(value);
  }

  protected onDateTo(value: string): void {
    this.dateToText.set(value);
  }

  /** Очищает форму, но не применяет её: список меняет только «Применить». */
  protected reset(): void {
    this.onlyWithoutCategories.set(false);
    this.categories.set([]);
    this.tags.set([]);
    this.dateFromText.set('');
    this.dateToText.set('');
  }

  protected apply(): void {
    if (!this.canApply()) {
      return;
    }

    this.dialogRef.close({
      kind: 'applied',
      filter: {
        onlyWithoutCategories: this.onlyWithoutCategories(),
        categoryIds: this.categories().map((item) => item.id),
        tagIds: this.tags().map((item) => item.id),
        dateFrom: parseOptionalDate(this.dateFromText()),
        dateTo: parseOptionalDate(this.dateToText()),
      },
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  /**
   * Подставляет подписи выбранному: фильтр хранит одни идентификаторы.
   *
   * Идентификаторы, которых у владельца больше нет, отбрасываются. Такой
   * фильтр сервер отвергает целиком, и молча оставленный в форме он не давал
   * бы загрузить список - причём именно тот, который человек и не выбирал.
   */
  private loadSelection(): void {
    forkJoin({ categories: this.api.getCategories(), tags: this.api.getTags() }).subscribe({
      next: ({ categories, tags }) => {
        this.categories.set(toCategoryItems(this.data.filter.categoryIds, categories));
        this.tags.set(toTagItems(this.data.filter.tagIds, tags));
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }
}

/** Полный путь категории: одноимённые ветки иначе неразличимы в чипсах. */
function toCategoryItems(
  ids: readonly string[],
  categories: readonly Category[],
): readonly FilterItem[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return ids
    .map((id) => byId.get(id))
    .filter((category): category is Category => category !== undefined)
    .map((category) => ({ id: category.id, title: categoryPath(category, categories) }));
}

function toTagItems(ids: readonly string[], tags: readonly Tag[]): readonly FilterItem[] {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));

  return ids
    .map((id) => byId.get(id))
    .filter((tag): tag is Tag => tag !== undefined)
    .map((tag) => ({ id: tag.id, title: tag.title }));
}

function formatOptionalDate(date: Date | null): string {
  return date ? formatApiDate(date) : '';
}

function parseOptionalDate(text: string): Date | null {
  return text.trim() === '' ? null : parseApiDate(text);
}

/** Пустая граница - это «без ограничения», поэтому ошибкой не считается. */
function dateError(text: string): string | null {
  if (text.trim() === '') {
    return null;
  }

  return parseApiDate(text) ? null : `Дата в формате ${DATE_INPUT_FORMAT}`;
}