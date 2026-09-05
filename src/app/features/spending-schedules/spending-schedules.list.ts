import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingSchedule, isScheduleFinished } from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { formatDateTimeLabel } from '../../shared/util/date.util';
import { describeRecurrence } from '../../shared/util/recurrence.util';
import {
  SpendingScheduleDetailsResult,
  SpendingScheduleDetailsSheet,
} from './spending-schedule-details.sheet';
import { SpendingSchedulesStore } from './spending-schedules.store';

@Component({
  selector: 'app-spending-schedules-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, MoneyPipe],
  templateUrl: './spending-schedules.list.html',
  styleUrl: './spending-schedules.list.scss',
})
export class SpendingSchedulesList {
  private readonly currencies = inject(CurrenciesStore);
  private readonly sheets = inject(SheetService);

  /** Ручной запуск расписания создал трату: список трат устарел. */
  readonly spendingCreated = output<void>();

  protected readonly store = inject(SpendingSchedulesStore);

  constructor() {
    this.store.ensureLoaded();
  }

  protected openSchedule(schedule: SpendingSchedule): void {
    this.sheets
      .openSheet<SpendingScheduleDetailsResult, string>(
        SpendingScheduleDetailsSheet,
        schedule.id,
        { ariaLabel: 'Расписание траты' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        if (result.kind === 'deleted') {
          this.store.removeLocally(result.id);
          return;
        }

        this.store.replaceLocally(result.schedule);

        if (result.hasNewSpending) {
          this.spendingCreated.emit();
        }
      });
  }

  protected describe(schedule: SpendingSchedule): string {
    return describeRecurrence(schedule);
  }

  protected statusLabel(schedule: SpendingSchedule): string {
    if (!schedule.isActive) {
      return 'На паузе';
    }

    if (isScheduleFinished(schedule)) {
      return 'Завершено';
    }

    const next = formatDateTimeLabel(schedule.nextOccurrenceDate);

    return next ? `Следующая: ${next}` : 'Активно';
  }

  /** Расписание, у которого впереди есть срабатывание: только его статус акцентен. */
  protected isRunning(schedule: SpendingSchedule): boolean {
    return schedule.isActive && !isScheduleFinished(schedule);
  }

  protected currencyCode(currencyId: string): string {
    return this.currencies.codeOf(currencyId);
  }

  protected retry(): void {
    this.store.reload();
  }
}
