import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Category } from '../../domain/models/models';
import { EmptyStateComponent } from './empty-state.component';
import { IconComponent } from './icon.component';
import { SwipeToCloseDirective } from '../util/swipe-to-close.directive';
import {
  CategoryRow,
  categoryPath,
  flattenCategoryTree,
  parentCategoryIds,
} from '../util/category-tree.util';

export interface CategoryPickerData {
  /** Категории, которые нельзя выбрать: сама ветка при переносе, текущий выбор. */
  readonly excludedIds?: readonly string[];

  /** Подпись отдельного пункта над списком: «Без категории», «В корень дерева». */
  readonly rootOptionLabel?: string;

  /**
   * Разрешено ли заводить категорию прямо из выбора.
   *
   * Выключается там, где вызывающий не умеет создавать категорию, - иначе
   * кнопка «Создать» видна, но нажатие ничего не делает.
   */
  readonly allowCreate?: boolean;

  readonly title?: string;
}

export type CategoryPickerResult =
  | { readonly kind: 'existing'; readonly category: Category }
  | { readonly kind: 'new'; readonly title: string; readonly parentId: string | null }
  | { readonly kind: 'root' };

/**
 * Выбор одной категории по дереву.
 *
 * Ветки свёрнуты, пока их не раскроют: список категорий длинный, а с плоским
 * перечнем вложенность не читается вовсе. Поиск разворачивает результат в
 * плоский список с полным путём - там уровни уже ничего не объясняют.
 */
@Component({
  selector: 'app-category-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, SwipeToCloseDirective],
  template: `
    <div class="sheet" appSwipeToClose (dismissed)="close()">
      <div class="sheet__grabber" aria-hidden="true"></div>

      <div class="sheet__header">
        <h2 class="sheet__title">{{ title }}</h2>
        <button type="button" class="icon-btn" aria-label="Закрыть" (click)="close()">
          <app-icon name="close" />
        </button>
      </div>

      <div class="search">
        <app-icon class="search__icon" name="search" />
        <input
          class="field__control search__input"
          type="text"
          placeholder="Название категории"
          autocomplete="off"
          [value]="query()"
          (input)="onQuery($event)"
        />
      </div>

      <div class="sheet__body">
        @if (rootOptionLabel) {
          <button type="button" class="panel panel--bordered root-option" (click)="selectRoot()">
            <span class="root-option__icon"><app-icon name="close" /></span>
            <span class="truncate">{{ rootOptionLabel }}</span>
          </button>
        }

        @if (canCreate()) {
          <button type="button" class="panel panel--bordered create" (click)="createNew()">
            <span class="create__icon"><app-icon name="plus" /></span>
            <span class="create__text">
              Создать категорию «<b>{{ query().trim() }}</b>»
            </span>
          </button>
        }

        @if (isLoading()) {
          <div class="panel panel--bordered">
            @for (row of [1, 2, 3, 4]; track row) {
              <div class="panel__row">
                <span class="skeleton skeleton__row"></span>
              </div>
            }
          </div>
        } @else if (rows().length > 0) {
          <div class="panel panel--bordered">
            @for (row of rows(); track row.category.id) {
              <div class="picker-row" [attr.data-level]="row.level">
                @if (row.hasChildren) {
                  <button
                    type="button"
                    class="picker-row__toggle"
                    [attr.aria-expanded]="row.isExpanded"
                    [attr.aria-label]="
                      (row.isExpanded ? 'Свернуть ' : 'Раскрыть ') + row.category.title
                    "
                    (click)="toggle(row)"
                  >
                    <app-icon [name]="row.isExpanded ? 'chevron-down' : 'chevron-right'" />
                  </button>
                } @else {
                  <span class="picker-row__toggle picker-row__toggle--empty" aria-hidden="true"></span>
                }

                <button
                  type="button"
                  class="picker-row__button"
                  [disabled]="isExcluded(row.category.id)"
                  (click)="select(row.category)"
                >
                  <app-icon class="row__icon" name="folder" />
                  <span class="truncate">{{ row.category.title }}</span>
                </button>
              </div>
            }
          </div>
        } @else if (found().length > 0) {
          <div class="panel panel--bordered">
            @for (category of found(); track category.id) {
              <button
                type="button"
                class="panel__row"
                [disabled]="isExcluded(category.id)"
                (click)="select(category)"
              >
                <app-icon class="row__icon" name="folder" />
                <span class="truncate">{{ path(category) }}</span>
              </button>
            }
          </div>
        } @else if (!canCreate()) {
          <app-empty-state
            icon="folder"
            [title]="query() ? 'Ничего не нашлось' : 'Свободных категорий нет'"
            [hint]="emptyHint"
          />
        }
      </div>
    </div>
  `,
  styleUrl: './category-picker.sheet.scss',
})
export class CategoryPickerSheet {
  private readonly data = inject<CategoryPickerData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<CategoryPickerResult>>(DialogRef);
  private readonly api = inject(SpendingApiService);

  protected readonly title = this.data.title ?? 'Категория';
  protected readonly rootOptionLabel = this.data.rootOptionLabel ?? null;

  /** Где создавать категорию нельзя, подсказка не должна обещать создание. */
  protected readonly emptyHint =
    this.data.allowCreate === false
      ? 'Подходящей категории нет: заведите её на вкладке «Разметка».'
      : 'Начните вводить название, чтобы создать новую.';

  protected readonly query = signal('');
  protected readonly isLoading = signal(true);

  private readonly all = signal<readonly Category[]>([]);
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  private readonly excluded = new Set(this.data.excludedIds ?? []);

  /** Совпадения по названию: показываются плоским списком с полным путём. */
  protected readonly found = computed(() => {
    const needle = this.query().trim().toLowerCase();
    if (!needle) {
      return [];
    }

    return this.all()
      .filter((category) => category.title.toLowerCase().includes(needle))
      .sort((left, right) => left.title.localeCompare(right.title, 'ru'));
  });

  /** Дерево показывается, пока не начали искать. */
  protected readonly rows = computed<readonly CategoryRow[]>(() =>
    this.query().trim() ? [] : flattenCategoryTree(this.all(), this.expanded()),
  );

  /** Создание предлагается, только если оно разрешено и такого названия ещё нет. */
  protected readonly canCreate = computed(() => {
    const title = this.query().trim();
    if (title === '' || this.data.allowCreate === false) {
      return false;
    }

    return !this.all().some(
      (category) => category.title.toLowerCase() === title.toLowerCase(),
    );
  });

  constructor() {
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.all.set(categories);
        // Верхний уровень раскрыт сразу: свёрнутое дерево целиком выглядит
        // как список из трёх строк, и непонятно, что внутри что-то есть.
        this.expanded.set(new Set(parentCategoryIds(categories)));
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected isExcluded(categoryId: string): boolean {
    return this.excluded.has(categoryId);
  }

  protected path(category: Category): string {
    return categoryPath(category, this.all());
  }

  protected toggle(row: CategoryRow): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(row.category.id)) {
        next.add(row.category.id);
      }

      return next;
    });
  }

  protected select(category: Category): void {
    this.dialogRef.close({ kind: 'existing', category });
  }

  protected selectRoot(): void {
    this.dialogRef.close({ kind: 'root' });
  }

  protected createNew(): void {
    this.dialogRef.close({ kind: 'new', title: this.query().trim(), parentId: null });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
