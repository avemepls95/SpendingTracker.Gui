import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { TelegramService } from '../../core/telegram/telegram.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';

/** Основы разметки или подробности про теги. */
export type MarkupGuideSection = 'basics' | 'tags';

export interface MarkupGuideData {
  readonly section: MarkupGuideSection;
}

/**
 * Справка по разметке трат.
 *
 * Лист, а не отдельный маршрут: справку зовут из карточки траты и из редактора
 * тега, то есть поверх уже открытого листа. Переход по адресу закрыл бы форму
 * вместе с несохранёнными полями, а лист ложится сверху и возвращает на место.
 */
@Component({
  selector: 'app-markup-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SwipeToCloseDirective],
  templateUrl: './markup-guide.sheet.html',
  styleUrl: './markup-guide.sheet.scss',
})
export class MarkupGuideSheet {
  private readonly data = inject<MarkupGuideData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<void>>(DialogRef);
  private readonly telegram = inject(TelegramService);

  /** Раздел, с которого открыли: зависит от того, откуда позвали. */
  protected readonly section = signal<MarkupGuideSection>(this.data.section);

  protected setSection(section: MarkupGuideSection): void {
    if (section === this.section()) {
      return;
    }

    this.telegram.selectionChanged();
    this.section.set(section);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
