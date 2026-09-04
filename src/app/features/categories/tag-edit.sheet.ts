import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Tag } from '../../domain/models/models';
import { confirmAction } from '../../shared/ui/confirm.dialog';
import { IconComponent } from '../../shared/ui/icon.component';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';

export type TagEditData =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly tag: Tag };

export type TagEditResult = { readonly kind: 'changed' };

/** Названия групп, которые предлагаются подсказкой: остальные вводятся руками. */
const GROUP_SUGGESTIONS = ['Место', 'Поездка', 'Характер'] as const;

@Component({
  selector: 'app-tag-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SwipeToCloseDirective],
  templateUrl: './tag-edit.sheet.html',
  styleUrl: './tag-edit.sheet.scss',
})
export class TagEditSheet {
  private readonly data = inject<TagEditData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<TagEditResult>>(DialogRef);
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);
  private readonly telegram = inject(TelegramService);
  private readonly toast = inject(ToastService);

  private readonly existing = this.data.mode === 'edit' ? this.data.tag : null;

  protected readonly isEdit = this.existing !== null;
  protected readonly title = this.isEdit ? 'Тег' : 'Новый тег';
  protected readonly groupSuggestions = GROUP_SUGGESTIONS;

  protected readonly name = signal(this.existing?.title ?? '');
  protected readonly group = signal(this.existing?.group ?? '');
  protected readonly isSaving = signal(false);

  /** Новый тег заводится без переноса: цена ошибочного переноса выше. */
  protected readonly spreads = signal(this.existing?.spreadsByDescription ?? false);

  /** Объяснение признака развёрнуто: оно длинное и нужно не каждый раз. */
  protected readonly isSpreadHelpOpen = signal(false);

  protected readonly nameError = computed(() =>
    this.name().trim() === '' ? 'Укажите название' : null,
  );

  protected readonly canSave = computed(
    () => !this.isSaving() && this.nameError() === null,
  );

  protected onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected onGroup(event: Event): void {
    this.group.set((event.target as HTMLInputElement).value);
  }

  protected onSpreads(event: Event): void {
    this.spreads.set((event.target as HTMLInputElement).checked);
  }

  protected toggleSpreadHelp(): void {
    this.isSpreadHelpOpen.update((open) => !open);
  }

  protected pickGroup(value: string): void {
    // Повторное нажатие снимает группу: иначе выбранную подсказку пришлось бы
    // стирать вручную из поля.
    this.group.update((current) => (current === value ? '' : value));
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }

    this.isSaving.set(true);

    const title = this.name().trim();
    const group = this.group().trim() || null;

    const spreadsByDescription = this.spreads();

    const request = this.existing
      ? this.api.updateTag({ id: this.existing.id, title, group, spreadsByDescription })
      : this.api.createTag(title, group, spreadsByDescription);

    request.subscribe({
      next: () => {
        this.telegram.notify('success');
        this.toast.success(this.isEdit ? 'Тег сохранён' : 'Тег создан');
        this.dialogRef.close({ kind: 'changed' });
      },
      error: () => this.isSaving.set(false),
    });
  }

  protected async remove(): Promise<void> {
    const tag = this.existing;
    if (!tag) {
      return;
    }

    const confirmed = await confirmAction(this.sheets, this.telegram, {
      title: 'Удалить тег?',
      message: `«${tag.title}» исчезнет со всех трат и категорий. Сами траты останутся.`,
      confirmLabel: 'Удалить',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    this.isSaving.set(true);
    this.api.deleteTag(tag.id).subscribe({
      next: () => {
        this.telegram.notify('success');
        this.dialogRef.close({ kind: 'changed' });
      },
      error: () => this.isSaving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
