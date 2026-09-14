import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Spending } from '../../domain/models/models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../shared/pipes/short-date.pipe';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';

export interface ReportSpendingsData {
  /** null - строка отчёта не по категории, а по тегу. */
  readonly categoryId: string | null;
  /** Теги отбора: фильтр отчёта вместе с тегом самой строки. */
  readonly tagIds: readonly string[];
  readonly title: string;
  readonly amount: number;
  readonly dateFrom: Date;
  readonly dateTo: Date;
  readonly targetCurrencyId: string;
  readonly currencyCode: string;
}

/** Траты за строкой отчёта: категории или тега за период отчёта. */
@Component({
  selector: 'app-report-spendings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, MoneyPipe, ShortDatePipe, SwipeToCloseDirective],
  template: `
    <div class="sheet" appSwipeToClose (dismissed)="close()">
      <div class="sheet__grabber" aria-hidden="true"></div>

      <div class="sheet__header">
        <div class="head">
          <h2 class="sheet__title head__title">{{ data.title }}</h2>
          <p class="head__amount amount">
            {{ data.amount | money }}&nbsp;{{ data.currencyCode }}
          </p>
        </div>
        <button type="button" class="icon-btn" aria-label="Закрыть" (click)="close()">
          <app-icon name="close" />
        </button>
      </div>

      <div class="sheet__body">
        @if (isLoading()) {
          <div class="panel panel--bordered" aria-busy="true">
            @for (row of [1, 2, 3, 4]; track row) {
              <div class="panel__row">
                <span class="skeleton row__skeleton-date"></span>
                <span class="skeleton row__skeleton-title"></span>
                <span class="skeleton row__skeleton-amount"></span>
              </div>
            }
          </div>
        } @else if (spendings().length === 0) {
          <app-empty-state
            icon="receipt"
            title="Трат не нашлось"
            hint="За выбранный период подходящих записей нет."
          />
        } @else {
          <div class="panel panel--bordered">
            @for (spending of spendings(); track spending.id) {
              <div class="panel__row row">
                <span class="row__date">{{ spending.date | shortDate }}</span>
                <span class="row__title">{{ spending.description }}</span>
                <!-- Сервер уже пересчитал сумму в валюту сводки, а currencyId
                     оставил исходным: подпись берётся от валюты сводки. -->
                <span class="row__amount amount">
                  {{ spending.amount | money }}
                  <span class="row__currency">{{ data.currencyCode }}</span>
                </span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './report-spendings.sheet.scss',
})
export class ReportSpendingsSheet {
  protected readonly data = inject<ReportSpendingsData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<void>>(DialogRef);
  private readonly api = inject(SpendingApiService);

  protected readonly spendings = signal<readonly Spending[]>([]);
  protected readonly isLoading = signal(true);

  constructor() {
    this.api
      .getFilteredSpendings({
        categoryId: this.data.categoryId,
        tagIds: this.data.tagIds,
        dateFrom: this.data.dateFrom,
        dateTo: this.data.dateTo,
        targetCurrencyId: this.data.targetCurrencyId,
      })
      .subscribe({
        next: (spendings) => {
          this.spendings.set(spendings);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
