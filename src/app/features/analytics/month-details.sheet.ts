import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { CategoryAnalyticsItem } from '../../domain/models/models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';
import { MIN_VISIBLE_AMOUNT } from './analytics.constants';
import {
  CategorySpendingsData,
  CategorySpendingsSheet,
} from './category-spendings.sheet';

export interface MonthDetailsData {
  /** Название месяца в шапке, например «Март 2026». */
  readonly title: string;

  /** Границы месяца: по ним же запрашивается разбивка и открываются траты. */
  readonly dateFrom: Date;
  readonly dateTo: Date;

  readonly totalAmount: number;
  readonly regularAmount: number;
  readonly oneTimeAmount: number;

  /** Медиана ряда: относительно неё считается отклонение месяца. */
  readonly medianAmount: number;

  readonly targetCurrencyId: string;
  readonly currencyCode: string;

  /** Фильтр отчёта: без него разбивка не сойдётся с итогом месяца. */
  readonly tagIds: readonly string[];
}

/** Строка разбивки месяца по категориям. */
interface CategoryRow {
  /**
   * Ключ для @for. По подписи трекать нельзя: заголовок синтетической строки
   * ничем не защищён от совпадения с названием настоящей категории.
   */
  readonly key: string;

  readonly categoryId: string | null;
  readonly title: string;
  readonly amount: number;
  readonly share: number;
}

/** Месяц под столбцом диаграммы: из чего он состоит и чем отличается от обычного. */
@Component({
  selector: 'app-month-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, MoneyPipe, SwipeToCloseDirective],
  template: `
    <div class="sheet" appSwipeToClose (dismissed)="close()">
      <div class="sheet__grabber" aria-hidden="true"></div>

      <div class="sheet__header">
        <div class="head">
          <h2 class="sheet__title head__title">{{ data.title }}</h2>
          <p class="head__amount amount">
            {{ data.totalAmount | money }}&nbsp;{{ data.currencyCode }}
          </p>
        </div>
        <button type="button" class="icon-btn" aria-label="Закрыть" (click)="close()">
          <app-icon name="close" />
        </button>
      </div>

      <div class="sheet__body">
        <div class="facts">
          <div class="fact">
            <span class="fact__label">Регулярные</span>
            <span class="fact__value amount">{{ data.regularAmount | money }}</span>
          </div>
          <div class="fact">
            <span class="fact__label">Разовые</span>
            <span class="fact__value amount">{{ data.oneTimeAmount | money }}</span>
          </div>
          <div class="fact">
            <span class="fact__label">Против обычного</span>
            @if (deviation(); as value) {
              <span
                class="fact__value"
                [class.fact__value--above]="value > 0"
                [class.fact__value--below]="value < 0"
              >
                {{ value > 0 ? '+' : '' }}{{ value }}%
              </span>
            } @else {
              <span class="fact__value fact__value--muted">как обычно</span>
            }
          </div>
        </div>

        @if (isLoading()) {
          <div class="panel panel--bordered" aria-busy="true">
            @for (row of [1, 2, 3, 4]; track row) {
              <div class="panel__row">
                <span class="skeleton row__skeleton-title"></span>
                <span class="skeleton row__skeleton-amount"></span>
              </div>
            }
          </div>
        } @else if (hasError()) {
          <app-empty-state
            icon="alert-circle"
            title="Не удалось загрузить разбивку"
            hint="Итог за месяц посчитан, а из чего он сложился - неизвестно."
          >
            <button type="button" class="btn btn--primary" (click)="load()">Повторить</button>
          </app-empty-state>
        } @else if (rows().length === 0) {
          <app-empty-state
            icon="folder"
            title="Разбивки нет"
            hint="Итог за месяц посчитан, но ни одна трата не отнесена к категории."
          />
        } @else {
          <div class="panel panel--bordered">
            @for (row of rows(); track row.key) {
              @if (row.categoryId) {
                <button
                  type="button"
                  class="panel__row row row--action"
                  (click)="openCategory(row)"
                >
                  <span class="row__title truncate">{{ row.title }}</span>
                  <span class="row__share">{{ row.share }}%</span>
                  <span class="row__amount amount">{{ row.amount | money }}</span>
                  <app-icon name="chevron-right" />
                </button>
              } @else {
                <div class="panel__row row">
                  <span class="row__title truncate row__title--muted">{{ row.title }}</span>
                  <span class="row__share">{{ row.share }}%</span>
                  <span class="row__amount amount">{{ row.amount | money }}</span>
                </div>
              }
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './month-details.sheet.scss',
})
export class MonthDetailsSheet {
  protected readonly data = inject<MonthDetailsData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<void>>(DialogRef);
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);

  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  private readonly categories = signal<readonly CategoryAnalyticsItem[]>([]);

  /**
   * Насколько месяц дороже обычного, в процентах от медианы ряда.
   *
   * null - сравнивать не с чем или разница меньше процента: «+0%» выглядит
   * как сбой округления, а не как ответ.
   */
  protected readonly deviation = computed<number | null>(() => {
    if (this.data.medianAmount < MIN_VISIBLE_AMOUNT) {
      return null;
    }

    const value = Math.round(
      ((this.data.totalAmount - this.data.medianAmount) / this.data.medianAmount) * 100,
    );

    return value === 0 ? null : value;
  });

  protected readonly rows = computed<readonly CategoryRow[]>(() => {
    const total = this.data.totalAmount;
    const visible = this.categories()
      .filter((item) => item.amount >= MIN_VISIBLE_AMOUNT)
      .sort((left, right) => right.amount - left.amount);

    const rows: CategoryRow[] = visible.map((item) => ({
      key: item.categoryId,
      categoryId: item.categoryId,
      title: item.categoryTitle,
      amount: item.amount,
      share: share(item.amount, total),
    }));

    // Итог месяца считает все траты, а дерево категорий - только разнесённые.
    // Без этой строки список не сходился бы с суммой в шапке, и разница
    // выглядела бы как ошибка подсчёта.
    const uncategorized = total - visible.reduce((sum, item) => sum + item.amount, 0);
    if (uncategorized >= MIN_VISIBLE_AMOUNT) {
      rows.push({
        key: 'uncategorized',
        categoryId: null,
        title: 'Без категории',
        amount: uncategorized,
        share: share(uncategorized, total),
      });
    }

    return rows;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.api
      .getCategoriesAnalytics(
        this.data.dateFrom,
        this.data.dateTo,
        this.data.targetCurrencyId,
        this.data.tagIds,
      )
      .subscribe({
        next: (analytics) => {
          this.categories.set(analytics.categories);
          this.isLoading.set(false);
        },
        error: () => {
          // Сбой запроса нельзя показывать как «трат без категории нет»:
          // пустой список - это утверждение о данных, а его тут нет.
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  protected openCategory(row: CategoryRow): void {
    if (!row.categoryId) {
      return;
    }

    this.sheets.openSheet<void, CategorySpendingsData>(
      CategorySpendingsSheet,
      {
        categoryId: row.categoryId,
        title: row.title,
        amount: row.amount,
        dateFrom: this.data.dateFrom,
        dateTo: this.data.dateTo,
        targetCurrencyId: this.data.targetCurrencyId,
        currencyCode: this.data.currencyCode,
      },
      { ariaLabel: `Траты категории ${row.title}` },
    );
  }

  protected close(): void {
    this.dialogRef.close();
  }
}

function share(amount: number, total: number): number {
  return total > 0 ? Math.round((amount / total) * 100) : 0;
}
