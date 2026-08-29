import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Category, Tag } from '../../domain/models/models';
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

export type CategoryEditData =
  | { readonly mode: 'create'; readonly parentId?: string | null }
  | { readonly mode: 'edit'; readonly category: Category };

export type CategoryEditResult = { readonly kind: 'changed' };

/**
 * Правка категории: название, место в дереве и теги.
 *
 * Название сохраняется по кнопке, а родитель и теги применяются сразу: это
 * отдельные запросы, и держать их до «Сохранить» значило бы копить в листе
 * состояние, которое всё равно нельзя откатить.
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

  /** Связи меняются сразу, поэтому список нужно обновить даже при отмене правки имени. */
  private touched = false;

  protected readonly isEdit = this.existing !== null;
  protected readonly title = this.isEdit ? 'Категория' : 'Новая категория';

  protected readonly name = signal(this.existing?.title ?? '');
  protected readonly parentId = signal<string | null>(
    this.existing?.parentId ?? this.createParentId,
  );
  protected readonly tags = signal<readonly Tag[]>(this.existing?.tags ?? []);
  protected readonly isSaving = signal(false);
  protected readonly isLinkBusy = signal(false);

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
    // Родитель и теги применяются сразу: список категорий нужно обновить
    // и когда лист закрыли Escape или тапом мимо.
    closeOnDismiss(this.dialogRef, () => this.close());

    this.api.getCategories().subscribe({
      next: (categories) => this.allCategories.set(categories),
    });
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


        const newParentId = result.kind === 'root' ? null : result.category.id;
        if (!category) {
          this.parentId.set(newParentId);
          return;
        }

        this.isLinkBusy.set(true);
        this.api.moveCategory(category.id, newParentId).subscribe({
          next: () => {
            this.parentId.set(newParentId);
            this.touched = true;
            this.isLinkBusy.set(false);
            this.telegram.impact('light');
          },
          error: () => this.isLinkBusy.set(false),
        });
      });
  }

  // ------------------------------------------------------------ теги

  protected addTag(): void {
    const category = this.existing;
    if (!category) {
      return;
    }

    this.sheets
      .openSheet<TagPickerResult, TagPickerData>(
        TagPickerSheet,
        { excludedIds: this.tags().map((tag) => tag.id) },
        { ariaLabel: 'Выбор тега' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        this.isLinkBusy.set(true);

        if (result.kind === 'existing') {
          this.api.setCategoryTag(category.id, result.tag.id, true).subscribe({
            next: () => this.refreshTags(category.id),
            error: () => this.isLinkBusy.set(false),
          });

          return;
        }

        // Идентификатор нового тега знает только сервер, поэтому связь
        // навешивается после того, как список тегов перечитан.
        this.api.createTag(result.title).subscribe({
          next: () => this.attachCreatedTag(category.id, result.title),
          error: () => this.isLinkBusy.set(false),
        });
      });
  }

  protected removeTag(tag: Tag): void {
    const category = this.existing;
    if (!category) {
      return;
    }

    this.isLinkBusy.set(true);
    this.api.setCategoryTag(category.id, tag.id, false).subscribe({
      next: () => this.refreshTags(category.id),
      error: () => this.isLinkBusy.set(false),
    });
  }

  // ------------------------------------------------------------ действия

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
        if (result?.kind === 'changed') {
          this.touched = true;
          this.refreshTags(category.id);
        }
      });
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }

    this.isSaving.set(true);
    const title = this.name().trim();

    const request = this.existing
      ? this.api.updateCategory({ id: this.existing.id, title })
      : this.api.createCategory(title, this.parentId());

    request.subscribe({
      next: () => {
        this.telegram.notify('success');
        this.toast.success(this.isEdit ? 'Категория сохранена' : 'Категория создана');
        this.dialogRef.close({ kind: 'changed' });
      },
      error: () => this.isSaving.set(false),
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

  protected close(): void {
    this.dialogRef.close(this.touched ? { kind: 'changed' } : undefined);
  }

  private attachCreatedTag(categoryId: string, title: string): void {
    this.api.getTags().subscribe({
      next: (tags) => {
        const created = tags.find(
          (tag) => tag.title.toLowerCase() === title.toLowerCase(),
        );

        if (!created) {
          this.isLinkBusy.set(false);
          return;
        }

        this.api.setCategoryTag(categoryId, created.id, true).subscribe({
          next: () => this.refreshTags(categoryId),
          error: () => this.isLinkBusy.set(false),
        });
      },
      error: () => this.isLinkBusy.set(false),
    });
  }

  private refreshTags(categoryId: string): void {
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.allCategories.set(categories);

        const category = categories.find((item) => item.id === categoryId);
        this.tags.set(category?.tags ?? []);
        this.parentId.set(category?.parentId ?? null);

        this.touched = true;
        this.isLinkBusy.set(false);
        this.telegram.impact('light');
      },
      error: () => this.isLinkBusy.set(false),
    });
  }
}
