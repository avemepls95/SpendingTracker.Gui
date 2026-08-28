import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { CategoryAnalytics, CategoryAnalyticsItem } from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { UserSettingsStore } from '../../domain/stores/user-settings.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import {
  addDays,
  addMonths,
  formatInputDate,
  parseCalendarDate,
  startOfDay,
} from '../../shared/util/date.util';
import {
  CategorySpendingsData,
  CategorySpendingsSheet,
} from './category-spendings.sheet';

type Status = 'loading' | 'ready' | 'error' | 'no-currency';
export type PeriodPreset = 'month' | 'prevMonth' | 'quarter' | 'year' | 'custom';

interface Period {
  readonly from: Date;
  readonly to: Date;
}

/** Строка диаграммы: узел дерева, приведённый к плоскому виду. */
export interface BarRow {
  /**
   * Путь от корня до узла.
   *
   * Одна категория может входить сразу в несколько родительских, и тогда
   * сервер повторяет её в каждой ветке. По одному идентификатору такие строки
   * неразличимы: @for ругался бы на повторяющиеся ключи, а раскрытие узла в
   * одной ветке раскрывало бы его же во всех остальных.
   */
  readonly key: string;
  readonly categoryId: string;
  readonly title: string;
  readonly amount: number;
  readonly share: number;
  readonly width: number;
  readonly level: number;
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
}

/** Суммы ниже копейки в отчёте - шум округления, а не траты. */
const MIN_VISIBLE_AMOUNT = 0.01;

@Component({
  selector: 'app-analytics-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent, IconComponent, MoneyPipe, RouterLink],
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.scss',
})
export class AnalyticsPage {
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);
  private readonly settings = inject(UserSettingsStore);
  private readonly currencies = inject(CurrenciesStore);

  protected readonly status = signal<Status>('loading');
  protected readonly preset = signal<PeriodPreset>('month');
  protected readonly analytics = signal<CategoryAnalytics | null>(null);

  private readonly customFrom = signal(formatInputDate(addDays(new Date(), -30)));
  private readonly customTo = signal(formatInputDate(new Date()));
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly presets: readonly { id: PeriodPreset; label: string }[] = [
    { id: 'month', label: 'Этот месяц' },
    { id: 'prevMonth', label: 'Прошлый' },
    { id: 'quarter', label: '3 месяца' },
    { id: 'year', label: 'Год' },
    { id: 'custom', label: 'Период' },
  ];

  protected readonly fromValue = this.customFrom.asReadonly();
  protected readonly toValue = this.customTo.asReadonly();

  protected readonly currencyCode = computed(() =>
    this.currencies.codeOf(this.settings.viewCurrencyId()),
  );

  protected readonly total = computed(() => this.analytics()?.totalAmount ?? 0);

  /** За период есть траты, но ни одна не отнесена к категории. */
  protected readonly hasUncategorizedOnly = computed(() => {
    const data = this.analytics();
    return (
      data !== null &&
      data.totalAmount > MIN_VISIBLE_AMOUNT &&
      visibleRoots(data.categories).length === 0
    );
  });

  protected readonly isEmpty = computed(
    () => this.status() === 'ready' && this.total() <= MIN_VISIBLE_AMOUNT,
  );

  /** Дерево категорий, развёрнутое в плоский список строк диаграммы. */
  protected readonly rows = computed<readonly BarRow[]>(() => {
    const data = this.analytics();
    if (!data) {
      return [];
    }

    const roots = visibleRoots(data.categories);
    const scale = roots.reduce((max, item) => Math.max(max, item.amount), 0);
    const total = data.totalAmount || 1;
    const expanded = this.expanded();
    const rows: BarRow[] = [];

    const walk = (
      items: readonly CategoryAnalyticsItem[],
      level: number,
      parentKey: string,
    ): void => {
      for (const item of visibleRoots(items)) {
        const children = visibleRoots(item.children);
        const key = parentKey ? `${parentKey}/${item.categoryId}` : item.categoryId;
        const isExpanded = expanded.has(key);

        rows.push({
          key,
          categoryId: item.categoryId,
          title: item.categoryTitle,
          amount: item.amount,
          share: Math.round((item.amount / total) * 100),
          // Длина считается от самой крупной категории, чтобы диаграмма
          // занимала всю ширину даже когда траты равномерные.
          width: scale > 0 ? Math.max(2, Math.round((item.amount / scale) * 100)) : 0,
          level,
          hasChildren: children.length > 0,
          isExpanded,
        });

        if (isExpanded) {
          walk(children, level + 1, key);
        }
      }
    };

    walk(roots, 0, '');
    return rows;
  });

  constructor() {
    // Перезагрузка при смене периода и валюты сводки.
    effect(() => {
      const currencyId = this.settings.viewCurrencyId();
      const period = this.period();
      if (currencyId) {
        this.load(period, currencyId);
        return;
      }

      if (this.settings.isLoaded()) {
        this.status.set('no-currency');
      }
    });
  }

  protected selectPreset(preset: PeriodPreset): void {
    this.preset.set(preset);
  }

  protected onFrom(event: Event): void {
    this.customFrom.set((event.target as HTMLInputElement).value);
  }

  protected onTo(event: Event): void {
    this.customTo.set((event.target as HTMLInputElement).value);
  }

  /**
   * Раскрывает или сворачивает ветку.
   *
   * Отделено от перехода к тратам: у родительской категории есть и свои
   * траты, не отнесённые к дочерним, и раньше добраться до них было нельзя -
   * нажатие только раскрывало список.
   */
  protected toggle(row: BarRow): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(row.key)) {
        next.add(row.key);
      }
      return next;
    });
  }

  protected openCategory(row: BarRow): void {
    const period = this.period();

    this.sheets.openSheet<void, CategorySpendingsData>(
      CategorySpendingsSheet,
      {
        categoryId: row.categoryId,
        title: row.title,
        amount: row.amount,
        dateFrom: period.from,
        dateTo: period.to,
        targetCurrencyId: this.settings.viewCurrencyId(),
        currencyCode: this.currencyCode(),
      },
      { ariaLabel: `Траты категории ${row.title}` },
    );
  }

  protected retry(): void {
    const currencyId = this.settings.viewCurrencyId();
    if (currencyId) {
      this.load(this.period(), currencyId);
      return;
    }

    this.status.set('loading');
    this.settings.reload();
  }

  /** Границы выбранного периода. */
  private readonly period = computed<Period>(() => {
    const today = startOfDay(new Date());

    switch (this.preset()) {
      case 'month':
        return { from: startOfMonth(today), to: today };

      case 'prevMonth': {
        const previous = addMonths(startOfMonth(today), -1);
        return { from: previous, to: addDays(startOfMonth(today), -1) };
      }

      case 'quarter':
        return { from: addMonths(today, -3), to: today };

      case 'year':
        return { from: addMonths(today, -12), to: today };

      case 'custom': {
        const from = parseCalendarDate(this.customFrom()) ?? addDays(today, -30);
        const to = parseCalendarDate(this.customTo()) ?? today;
        // Перепутанные местами границы приводятся к нормальному порядку,
        // иначе сервер вернёт пустой отчёт без объяснения причины.
        return from <= to ? { from, to } : { from: to, to: from };
      }
    }
  });

  private load(period: Period, currencyId: string): void {
    this.status.set('loading');

    this.api.getCategoriesAnalytics(period.from, period.to, currencyId).subscribe({
      next: (analytics) => {
        this.analytics.set(analytics);
        this.expanded.set(new Set());
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }
}

/**
 * Значимые узлы по убыванию суммы.
 *
 * Порядок сервера произвольный, а диаграмма читается сверху вниз: без
 * сортировки самый длинный столбец оказывается в середине списка.
 */
function visibleRoots(
  items: readonly CategoryAnalyticsItem[],
): readonly CategoryAnalyticsItem[] {
  return items
    .filter((item) => item.amount >= MIN_VISIBLE_AMOUNT)
    .sort((left, right) => right.amount - left.amount);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
