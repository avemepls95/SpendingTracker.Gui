import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { TelegramService } from '../../core/telegram/telegram.service';
import { SheetService } from '../../core/ui/sheet.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import {
  MARKUP_VERDICT_HINTS,
  MARKUP_VERDICT_LABELS,
  MarkupEntry,
  MarkupOperationResult,
  MarkupVerdict,
} from '../../domain/models/models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { confirmAction } from '../../shared/ui/confirm.dialog';
import { IntersectDirective } from '../../shared/util/intersect.directive';
import { spendingsCount } from '../../shared/util/plural.util';
import { MarkupDictionaryStore } from './markup-dictionary.store';

interface VerdictFilter {
  readonly value: MarkupVerdict | null;
  readonly label: string;
}

/**
 * Словарь разметки: что система знает о каждом описании траты.
 *
 * Основной сценарий раздела - разбор догадок модели после первого прогона:
 * сводное уведомление в телеграме идёт без кнопок, и подтверждать сотни
 * записей человек приходит именно сюда.
 */
@Component({
  selector: 'app-markup-dictionary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MarkupDictionaryStore],
  imports: [EmptyStateComponent, IconComponent, IntersectDirective],
  templateUrl: './markup-dictionary.list.html',
  styleUrl: './markup-dictionary.list.scss',
})
export class MarkupDictionaryList {
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);
  private readonly telegram = inject(TelegramService);
  private readonly toast = inject(ToastService);

  protected readonly store = inject(MarkupDictionaryStore);

  /** Запись, по которой идёт запрос: её кнопки заблокированы, остальные нет. */
  protected readonly busyId = signal<string | null>(null);

  protected readonly verdictLabels = MARKUP_VERDICT_LABELS;
  protected readonly verdictHints = MARKUP_VERDICT_HINTS;

  /**
   * Догадки модели идут первым фильтром и выбраны по умолчанию: остальные
   * вердикты просматривают редко, а этот - основная работа в разделе.
   */
  protected readonly filters: readonly VerdictFilter[] = [
    { value: 'AssignedByModel', label: 'Догадки модели' },
    { value: 'AssignedByUser', label: 'Ваши' },
    { value: 'RejectedByUser', label: 'Отвергнутые' },
    { value: 'ModelFailed', label: 'Не вышло' },
    { value: 'None', label: 'Без решения' },
    { value: null, label: 'Все' },
  ];

  constructor() {
    this.store.ensureLoaded();
  }

  protected setVerdict(verdict: MarkupVerdict | null): void {
    this.telegram.selectionChanged();
    this.store.setVerdict(verdict);
  }

  protected retry(): void {
    this.store.reload();
  }

  protected loadMore(): void {
    this.store.loadMore();
  }

  /** Догадка модели становится решением человека; подсветка «от модели» гаснет. */
  protected confirm(entry: MarkupEntry): void {
    this.run(entry, this.api.confirmMarkup(entry.id), (result) => {
      this.store.applyVerdictLocally(entry.id, 'AssignedByUser');
      this.toast.success(
        result.affectedSpendings > 0
          ? `Подтверждено, обновлено ${spendingsCount(result.affectedSpendings)}`
          : 'Подтверждено',
      );
    });
  }

  /**
   * Отказ: описание закрывается от модели, категория снимается с трат.
   *
   * Массовая операция, поэтому с подтверждением - как и удаление.
   */
  protected async reject(entry: MarkupEntry): Promise<void> {
    const confirmed = await confirmAction(this.sheets, this.telegram, {
      title: 'Отвергнуть разметку?',
      message:
        `Категория снимется со всех трат с описанием «${entry.normalizedDescription}», ` +
        'кроме размеченных вручную. Модель об этом описании больше не спросят, ' +
        'пока вы не назначите категорию сами.',
      confirmLabel: 'Отвергнуть',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    this.run(entry, this.api.rejectMarkup({ markupId: entry.id }), (result) => {
      this.store.applyVerdictLocally(entry.id, 'RejectedByUser');
      this.toast.success(
        result.affectedSpendings > 0
          ? `Разметка снята с ${spendingsCount(result.affectedSpendings)}`
          : 'Разметка отвергнута',
      );
    });
  }

  /**
   * Удаление: стирается и знание, и запрет - описание снова уйдёт в модель.
   *
   * Отличие от отказа названо прямо в подтверждении: перепутать их дорого,
   * потому что удаление возвращает описание модели, а отказ - наоборот.
   */
  protected async remove(entry: MarkupEntry): Promise<void> {
    const confirmed = await confirmAction(this.sheets, this.telegram, {
      title: 'Удалить запись?',
      message:
        `Система забудет всё про «${entry.normalizedDescription}»: категория снимется ` +
        'с трат этого описания, кроме размеченных вручную, а само описание снова ' +
        'уйдёт в модель. Чтобы вместо этого запретить её догадки, отвергните разметку.',
      confirmLabel: 'Удалить',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    this.run(entry, this.api.deleteMarkup(entry.id), (result) => {
      this.store.removeLocally(entry.id);
      this.toast.success(
        result.affectedSpendings > 0
          ? `Запись удалена, разметка снята с ${spendingsCount(result.affectedSpendings)}`
          : 'Запись удалена',
      );
    });
  }

  /**
   * Общий ход операции над записью.
   *
   * wasApplied: false - «уже обработано», а не ошибка: запись успели изменить
   * из другой вкладки или кнопкой в телеграме. Список в этот момент устарел
   * целиком, поэтому он перечитывается, а не правится по месту.
   */
  private run(
    entry: MarkupEntry,
    request: Observable<MarkupOperationResult>,
    onApplied: (result: MarkupOperationResult) => void,
  ): void {
    this.busyId.set(entry.id);

    request.subscribe({
      next: (result) => {
        this.busyId.set(null);

        if (!result.wasApplied) {
          this.toast.info('Уже обработано');
          this.store.reload();
          return;
        }

        this.telegram.notify('success');
        onApplied(result);
      },
      error: () => this.busyId.set(null),
    });
  }
}
