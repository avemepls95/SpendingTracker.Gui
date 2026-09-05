import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Observable, concat, tap } from 'rxjs';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Category } from '../../domain/models/models';
import {
  CategoryPickerData,
  CategoryPickerResult,
  CategoryPickerSheet,
} from '../../shared/ui/category-picker.sheet';
import {
  TagPickerData,
  TagPickerResult,
  TagPickerSheet,
} from '../../shared/ui/tag-picker.sheet';
import { confirmAction } from '../../shared/ui/confirm.dialog';
import { IconComponent } from '../../shared/ui/icon.component';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';
import { closeOnDismiss } from '../../shared/util/dismiss.util';
import { categoryPath, subtreeIds } from '../../shared/util/category-tree.util';
import { DraftTag, DraftTags, draftTagKey } from '../../shared/util/tag-draft.util';
import {
  MarkupGuideData,
  MarkupGuideSection,
  MarkupGuideSheet,
} from '../help/markup-guide.sheet';

export type CategoryEditData =
  | { readonly mode: 'create'; readonly parentId?: string | null }
  | { readonly mode: 'edit'; readonly category: Category };

export type CategoryEditResult = { readonly kind: 'changed' };

/**
 * Правка категории: название, место в дереве и теги.
 *
 * Всё, что человек меняет в листе, копится в его состоянии и уходит на сервер
 * пачкой запросов по кнопке «Сохранить». Закрытие листа не применяет ничего.
 */
@Component({
  selector: 'app-category-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SwipeToCloseDirective],
  templateUrl: './category-edit.sheet.html',
  styleUrl: './category-edit.sheet.scss',
})
export class CategoryEditSheet {
  private readonly data = inject<CategoryEditData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<CategoryEditResult>>(DialogRef);
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);
  private readonly telegram = inject(TelegramService);
  private readonly toast = inject(ToastService);

  private readonly existing = this.data.mode === 'edit' ? this.data.category : null;
  private readonly createParentId =
    this.data.mode === 'create' ? (this.data.parentId ?? null) : null;

  /**
   * Что уже применено на сервере.
   *
   * Пока пусто, лист закрывается без результата - обновлять список категорий
   * не от чего. Значение появляется от сохранения, от вложенного листа
   * подкатегории и от пачки, оборвавшейся посреди сохранения.
   */
  private hasAppliedChanges = false;

  /** Название и родитель, известные серверу: с ними сравнивается правка. */
  private savedTitle = this.existing?.title ?? '';
  private savedParentId = this.existing?.parentId ?? null;

  protected readonly isEdit = this.existing !== null;
  protected readonly title = this.isEdit ? 'Категория' : 'Новая категория';

  protected readonly name = signal(this.existing?.title ?? '');
  protected readonly parentId = signal<string | null>(
    this.existing?.parentId ?? this.createParentId,
  );
  protected readonly tags = new DraftTags(this.existing?.tags ?? []);
  protected readonly isSaving = signal(false);

  protected readonly tagKey = draftTagKey;

  /** Все категории владельца: нужны для пути родителя и запрета переноса в себя. */
  private readonly allCategories = signal<readonly Category[]>([]);

  protected readonly parentLabel = computed(() => {
    const parentId = this.parentId();
    if (!parentId) {
      return 'В корне дерева';
    }

    const parent = this.allCategories().find((category) => category.id === parentId);

    return parent ? categoryPath(parent, this.allCategories()) : 'Родительская категория';
  });

  protected readonly nameError = computed(() =>
    this.name().trim() === '' ? 'Укажите название' : null,
  );

  protected readonly canSave = computed(
    () => !this.isSaving() && this.nameError() === null,
  );

  constructor() {
    // Подкатегорию заводит вложенный лист, и её появление надо донести до
    // страницы при любом способе закрытия, включая Escape и клик мимо.
    closeOnDismiss(this.dialogRef, () => this.close());

    this.loadCategories();
  }

  protected onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  // ------------------------------------------------------------ родитель

  protected changeParent(): void {
    const category = this.existing;

    // Ветку нельзя перенести внутрь самой себя, поэтому её категории
    // в выборе недоступны.
    const excludedIds = category
      ? [...subtreeIds(category.id, this.allCategories())]
      : [];

    this.sheets
      .openSheet<CategoryPickerResult, CategoryPickerData>(
        CategoryPickerSheet,
        {
          excludedIds,
          rootOptionLabel: 'В корень дерева',
          title: 'Родительская категория',
          // Родителем может стать только существующая категория: создавать её
          // здесь же значило бы заводить пустую ветку одним касанием.
          allowCreate: false,
        },
        { ariaLabel: 'Выбор родительской категории' },
      )
      .closed.subscribe((result) => {
        if (!result || result.kind === 'new') {
          return;
        }

        this.parentId.set(result.kind === 'root' ? null : result.category.id);
        this.telegram.impact('light');
      });
  }

  // ------------------------------------------------------------ теги

  protected addTag(): void {
    this.sheets
      .openSheet<TagPickerResult, TagPickerData>(
        TagPickerSheet,
        { excludedIds: this.tags.selectedIds() },
        { ariaLabel: 'Выбор тега' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        if (result.kind === 'existing') {
          this.tags.addExisting(result.tag);
        } else {
          this.tags.addNew(result.title);
        }

        this.telegram.impact('light');
      });
  }

  protected removeTag(tag: DraftTag): void {
    this.tags.remove(tag);
    this.telegram.impact('light');
  }

  // ------------------------------------------------------------ действия

  /**
   * Заводит подкатегорию вложенным листом.
   *
   * Единственное действие листа, которое применяется до «Сохранить»: у него
   * своя кнопка сохранения, и отложить создание некуда - подкатегории нужен
   * существующий родитель.
   */
  protected createChild(): void {
    const category = this.existing;
    if (!category) {
      return;
    }

    this.sheets
      .openSheet<CategoryEditResult, CategoryEditData>(
        CategoryEditSheet,
        { mode: 'create', parentId: category.id },
        { ariaLabel: 'Новая подкатегория' },
      )
      .closed.subscribe((result) => {
        if (result?.kind !== 'changed') {
          return;
        }

        this.hasAppliedChanges = true;
        // Перечитывается только дерево: несохранённые поля этого листа
        // трогать нельзя.
        this.loadCategories();
      });
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }

    this.isSaving.set(true);
    const title = this.name().trim();
    const category = this.existing;

    if (!category) {
      this.api.createCategory(title, this.parentId()).subscribe({
        next: () => {
          this.hasAppliedChanges = true;
          this.finishSave('Категория создана');
        },
        error: (error: unknown) => this.failSave(error),
      });

      return;
    }

    // Порядок осмысленный: сперва название, потом место в дереве, потом теги -
    // по оборвавшейся пачке видно, что успело примениться.
    const requests: Observable<unknown>[] = [];

    if (title !== this.savedTitle) {
      requests.push(
        this.api
          .updateCategory({ id: category.id, title })
          .pipe(tap(() => (this.savedTitle = title))),
      );
    }

    const parentId = this.parentId();
    if (parentId !== this.savedParentId) {
      requests.push(
        this.api
          .moveCategory(category.id, parentId)
          .pipe(tap(() => (this.savedParentId = parentId))),
      );
    }

    requests.push(
      ...this.tags.requests(this.api, (tagId, isSet) =>
        this.api.setCategoryTag(category.id, tagId, isSet),
      ),
    );

    if (requests.length === 0) {
      // Менять нечего: сообщать о сохранении, которого не было, незачем.
      this.closeWithResult();
      return;
    }

    concat(...requests).subscribe({
      next: () => (this.hasAppliedChanges = true),
      complete: () => this.finishSave('Категория сохранена'),
      error: (error: unknown) => this.failSave(error),
    });
  }

  protected async remove(): Promise<void> {
    const category = this.existing;
    if (!category) {
      return;
    }

    const confirmed = await confirmAction(this.sheets, this.telegram, {
      title: 'Удалить категорию?',
      message: `«${category.title}» исчезнет, её траты останутся без категории, а вложенные категории поднимутся на её место.`,
      confirmLabel: 'Удалить',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    this.isSaving.set(true);
    this.api.deleteCategory(category.id).subscribe({
      next: () => {
        this.telegram.notify('success');
        this.dialogRef.close({ kind: 'changed' });
      },
      error: () => this.isSaving.set(false),
    });
  }

  protected openGuide(section: MarkupGuideSection): void {
    this.sheets.openSheet<void, MarkupGuideData>(
      MarkupGuideSheet,
      { section },
      { ariaLabel: 'Как размечать траты' },
    );
  }

  protected close(): void {
    // Закрытие поверх незавершённой пачки отдало бы результат до первого
    // успешного ответа: страница не стала бы перечитывать список, а запросы
    // всё равно дошли бы до сервера.
    if (this.isSaving()) {
      return;
    }

    this.closeWithResult();
  }

  private closeWithResult(): void {
    this.dialogRef.close(this.hasAppliedChanges ? { kind: 'changed' } : undefined);
  }

  private loadCategories(): void {
    this.api.getCategories().subscribe({
      next: (categories) => this.allCategories.set(categories),
    });
  }

  private finishSave(message: string): void {
    this.telegram.notify('success');
    this.toast.success(message);
    this.closeWithResult();
  }

  /**
   * Оставляет лист открытым после сбоя.
   *
   * Состояние не теряется, а часть запросов могла примениться: страница
   * перечитает список при закрытии. Об отказе сервера сообщает перехватчик,
   * плашка нужна только собственным ошибкам сохранения.
   */
  private failSave(error: unknown): void {
    this.isSaving.set(false);

    if (!(error instanceof HttpErrorResponse)) {
      this.toast.error('Не удалось сохранить изменения');
    }
  }
}
