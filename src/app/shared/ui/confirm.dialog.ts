import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';

export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  /** Подпись подтверждающей кнопки: называет действие, а не отвечает «Да». */
  readonly confirmLabel: string;
  readonly destructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog" role="alertdialog" aria-labelledby="confirm-title">
      <h2 class="dialog__title" id="confirm-title">{{ data.title }}</h2>
      <p class="dialog__message">{{ data.message }}</p>
      <div class="dialog__actions">
        <button type="button" class="btn btn--secondary" (click)="close(false)">
          Отмена
        </button>
        <button
          type="button"
          class="btn"
          [class.btn--danger]="data.destructive"
          [class.btn--primary]="!data.destructive"
          (click)="close(true)"
        >
          {{ data.confirmLabel }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmRequest>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);

  protected close(result: boolean): void {
    this.dialogRef.close(result);
  }
}

/**
 * Спрашивает подтверждение необратимого действия.
 *
 * Кнопки подписаны действием - «Удалить» вместо «Да»: пара «Да / Нет» требует
 * перечитать вопрос, чтобы понять, что произойдёт.
 */
export function confirmAction(
  sheets: SheetService,
  telegram: TelegramService,
  request: ConfirmRequest,
): Promise<boolean> {
  telegram.impact('medium');

  return new Promise((resolve) => {
    sheets
      .openDialog<boolean, ConfirmRequest>(ConfirmDialog, request)
      .closed.subscribe((result) => resolve(result === true));
  });
}
