import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { UserSettingsStore } from '../../domain/stores/user-settings.store';
import { IconComponent } from '../../shared/ui/icon.component';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';

/**
 * Согласие на отправку описаний трат в языковую модель.
 *
 * Вынесено отдельным листом, а не строкой настроек: согласие требует
 * перечислить, что именно уходит наружу, и этот перечень в строку не
 * помещается. Решение принимается один раз, поэтому лишний переход не мешает.
 */
@Component({
  selector: 'app-ai-markup-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SwipeToCloseDirective],
  templateUrl: './ai-markup.sheet.html',
  styleUrl: './ai-markup.sheet.scss',
})
export class AiMarkupSheet {
  private readonly dialogRef = inject<DialogRef<void>>(DialogRef);
  private readonly settings = inject(UserSettingsStore);

  protected readonly consent = this.settings.aiMarkupUserConsent;
  protected readonly monthlyLimit = this.settings.aiMarkupMonthlyLimit;
  protected readonly isSaving = this.settings.isSaving;

  /**
   * Молчать о нулевом лимите нельзя: человек включил бы переключатель и ждал
   * разметки, которой не случится, а причина ему не видна - лимит правит
   * владелец сервиса, и из интерфейса он недоступен.
   */
  protected readonly isBlockedByLimit = this.settings.isAiMarkupBlocked;

  protected onToggle(event: Event): void {
    this.settings.setAiMarkupConsent((event.target as HTMLInputElement).checked);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
