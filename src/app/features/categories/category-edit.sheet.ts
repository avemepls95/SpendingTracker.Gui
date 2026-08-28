import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

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
import { confirmAction } from '../../shared/ui/confirm.dialog';
import { IconComponent } from '../../shared/ui/icon.component';

export type CategoryEditData =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly category: Category };

export type CategoryEditResult = { readonly kind: 'changed' };

/**
 * Правка категории и её родительских связей.
 *
 * Родители перенесены сюда из строки таблицы трат: там дерево категорий
 * раскрывалось прямо внутри ячейки и смешивало две разные задачи - какие
 * категории у траты и как категории вложены друг в друга.
 */
@Component({
  selector: 'app-category-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
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

  /** Связи меняются сразу, поэтому список нужно обновить даже при отмене правки имени. */
  private touched = false;

  protected readonly isEdit = this.existing !== null;
  protected readonly title = this.isEdit ? 'Категория' : 'Новая категория';

  protected readonly name = signal(this.existing?.title ?? '');
  protected readonly parents = signal<readonly Category[]>(
    this.existing?.parents ?? [],
  );
  protected readonly isSaving = signal(false);
  protected readonly isParentBusy = signal(false);

  protected readonly nameError = computed(() =>
    this.name().trim() === '' ? 'Укажите название' : null,
  );

  protected readonly canSave = computed(
    () => !this.isSaving() && this.nameError() === null,
  );

  protected onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected addParent(): void {
    const category = this.existing;
    if (!category) {
      return;
    }

    this.sheets
      .openSheet<CategoryPickerResult, CategoryPickerData>(CategoryPickerSheet, {
        // Сама категория и её текущие родители из списка исключены: связать
        // категорию с собой нельзя, повторная связь тоже отклоняется сервером.
        excludedIds: [category.id, ...this.parents().map((parent) => parent.id)],
      })
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        this.isParentBusy.set(true);

        const request =
          result.kind === 'existing'
            ? this.api.linkCategoryToParent(category.id, result.category.id)
            : this.api.linkCategoryToNewParent(category.id, result.title);

        request.subscribe({
          next: () => this.refreshParents(category.id),
          error: () => this.isParentBusy.set(false),
        });
      });
  }

  protected removeParent(parent: Category): void {
    const category = this.existing;
    if (!category) {
      return;
    }

    this.isParentBusy.set(true);
    this.api.unlinkCategoryFromParent(category.id, parent.id).subscribe({
      next: () => this.refreshParents(category.id),
      error: () => this.isParentBusy.set(false),
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
      : this.api.createCategory(title);

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
      message: `«${category.title}» исчезнет, а траты в ней останутся, но без категории.`,
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

  private refreshParents(categoryId: string): void {
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.parents.set(
          categories.find((item) => item.id === categoryId)?.parents ?? [],
        );
        this.touched = true;
        this.isParentBusy.set(false);
        this.telegram.impact('light');
      },
      error: () => this.isParentBusy.set(false),
    });
  }
}
