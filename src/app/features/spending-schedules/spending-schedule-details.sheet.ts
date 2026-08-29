import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingScheduleApiService } from '../../domain/api/spending-schedule-api.service';
import {
  SpendingSchedule,
  SpendingScheduleDetails,
  isScheduleFinished,
} from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { confirmAction } from '../../shared/ui/confirm.dialog';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../shared/pipes/short-date.pipe';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';
import { closeOnDismiss } from '../../shared/util/dismiss.util';
import { describeRecurrence } from '../../shared/util/recurrence.util';
import {
  SpendingScheduleEditData,
  SpendingScheduleEditResult,
  SpendingScheduleEditSheet,
} from './spending-schedule-edit.sheet';

export type SpendingScheduleDetailsResult =
  | {
      readonly kind: 'changed';
      readonly schedule: SpendingSchedule;
      /** Ручной запуск создал трату - список трат устарел. */
      readonly hasNewSpending: boolean;
    }
  | { readonly kind: 'deleted'; readonly id: string };

/**
 * Карточка расписания.
 *
 * Пауза, ручной запуск и удаление уходят на сервер сразу, поэтому лист обязан
 * вернуть странице обновлённое расписание при любом способе закрытия.
 */
@Component({
  selector: 'app-spending-schedule-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    IconComponent,
    MoneyPipe,
    ShortDatePipe,
    SwipeToCloseDirective,
  ],
  templateUrl: './spending-schedule-details.sheet.html',
  styleUrl: './spending-schedule-details.sheet.scss',
})
export class SpendingScheduleDetailsSheet {
  private readonly scheduleId = inject<string>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<SpendingScheduleDetailsResult>>(DialogRef);
  private readonly api = inject(SpendingScheduleApiService);
  private readonly sheets = inject(SheetService);
  private readonly telegram = inject(TelegramService);
  private readonly toast = inject(ToastService);
  private readonly currencies = inject(CurrenciesStore);

  protected readonly schedule = signal<SpendingScheduleDetails | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isBusy = signal(false);

  private hasNewSpending = false;

  constructor() {
    closeOnDismiss(this.dialogRef, () => this.close());
    this.load();
  }

  protected describe(schedule: SpendingSchedule): string {
    return describeRecurrence(schedule);
  }

  protected isFinished(schedule: SpendingSchedule): boolean {
    return isScheduleFinished(schedule);
  }

  protected currencyCode(currencyId: string): string {
    return this.currencies.codeOf(currencyId);
  }

  protected toggleActive(): void {
    const schedule = this.schedule();
    if (!schedule || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);

    this.api.setActive(schedule.id, !schedule.isActive).subscribe({
      next: () => {
        // Признак фиксируется сразу: перечитывание может не дойти, и тогда
        // карточка со списком показывали бы состояние до нажатия.
        this.schedule.update((current) =>
          current ? { ...current, isActive: !schedule.isActive } : current,
        );
        this.refresh();
      },
      error: () => this.isBusy.set(false),
    });
  }

  protected runNow(): void {
    const schedule = this.schedule();
    if (!schedule || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);

    // Ответ содержит обновлённую карточку целиком: после ручного запуска
    // надо обновить и историю, и счётчик.
    this.api.runNow(schedule.id).subscribe({
      next: (details) => {
        this.schedule.set(details);
        this.hasNewSpending = true;
        this.isBusy.set(false);
        this.telegram.notify('success');
        this.toast.success('Трата создана');
      },
      error: () => this.isBusy.set(false),
    });
  }

  protected async remove(): Promise<void> {
    const schedule = this.schedule();
    if (!schedule || this.isBusy()) {
      return;
    }

    const confirmed = await confirmAction(this.sheets, this.telegram, {
      title: 'Удалить расписание?',
      message: `«${schedule.description}» перестанет создавать траты. Уже созданные им траты останутся.`,
      confirmLabel: 'Удалить',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    this.isBusy.set(true);

    this.api.deleteSchedule(schedule.id).subscribe({
      next: () => {
        this.telegram.notify('success');
        this.dialogRef.close({ kind: 'deleted', id: schedule.id });
      },
      error: () => this.isBusy.set(false),
    });
  }

  protected edit(): void {
    const schedule = this.schedule();
    if (!schedule || this.isBusy()) {
      return;
    }

    this.sheets
      .openSheet<SpendingScheduleEditResult, SpendingScheduleEditData>(
        SpendingScheduleEditSheet,
        { schedule },
        { ariaLabel: 'Правка расписания' },
      )
      .closed.subscribe((result) => {
        if (result) {
          this.load();
        }
      });
  }

  protected retry(): void {
    this.load();
  }

  protected close(): void {
    // Закрытие поверх незавершённого удаления оставило бы в списке строку,
    // которой на сервере уже нет: ответ придёт в уничтоженный лист.
    if (this.isBusy()) {
      return;
    }

    const schedule = this.schedule();

    // Без расписания возвращать нечего: список и так показывает прежнюю строку.
    this.dialogRef.close(
      schedule
        ? { kind: 'changed', schedule, hasNewSpending: this.hasNewSpending }
        : undefined,
    );
  }

  private load(): void {
    this.isLoading.set(true);

    this.api.getSchedule(this.scheduleId).subscribe({
      next: (details) => {
        this.schedule.set(details);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  /** Перечитывает карточку: ближайшую дату после паузы пересчитывает сервер. */
  private refresh(): void {
    this.api.getSchedule(this.scheduleId).subscribe({
      next: (details) => {
        this.schedule.set(details);
        this.isBusy.set(false);
        this.telegram.impact('light');
      },
      error: () => this.isBusy.set(false),
    });
  }
}
