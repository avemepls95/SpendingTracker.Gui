import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SpendingSchedule, isScheduleFinished } from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { describeRecurrence } from '../../shared/util/recurrence.util';
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

  protected readonly store = inject(SpendingSchedulesStore);

  constructor() {
    this.store.ensureLoaded();
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

    return `Следующая: ${schedule.nextOccurrenceDate}`;
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
