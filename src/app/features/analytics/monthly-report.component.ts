import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import {
  MonthlyAnalytics,
  MonthlyAnalyticsExtremum,
  MonthlyAnalyticsSummary,
  Tag,
} from '../../domain/models/models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import {
  TagPickerData,
  TagPickerResult,
  TagPickerSheet,
} from '../../shared/ui/tag-picker.sheet';

type Status = 'loading' | 'ready' | 'error';

/** Глубина ряда. */
export type MonthlyRange = 'year' | 'twoYears' | 'all';

/** Столбец диаграммы. */
export interface MonthColumn {
  readonly key: string;
  readonly label: string;

  /** Подпись года под первым месяцем года: иначе ось повторяет год в каждом столбце. */
  readonly yearLabel: string | null;

  readonly totalAmount: number;
  readonly regularAmount: number;
  readonly oneTimeAmount: number;

  /** Доли высоты столбца, в процентах от самого дорогого месяца ряда. */
  readonly regularHeight: number;
  readonly oneTimeHeight: number;
}

/** Ячейка таблицы агрегатов. */
export interface SummaryCell {
  readonly amount: number;

  /**
   * Месяц, которому принадлежит сумма. null у средних и медианы - они не
   * принадлежат месяцу, - и у крайних, когда ряд ровный: там минимум и
   * максимум указали бы на один и тот же месяц, и подпись только сбивала бы.
   */
  readonly month: string | null;
}

/** Строка таблицы агрегатов. */
export interface SummaryRow {
  readonly label: string;
  readonly total: SummaryCell;
  readonly regular: SummaryCell;
  readonly oneTime: SummaryCell;
}

/** Строка разбивки регулярного. */
export interface BreakdownRow {
  readonly key: string;
  readonly title: string;

  /** Строка собирает регулярное без расписания - подписывается иначе. */
  readonly isTagged: boolean;
  readonly amount: number;
  readonly width: number;
}

type TagFilterItem = Pick<Tag, 'id' | 'title'>;

/** Суммы ниже копейки - шум округления, а не траты. */
const MIN_VISIBLE_AMOUNT = 0.01;

/** Заведомо ранняя граница для «всего времени»: сервер подрежет её по первой трате. */
const EARLIEST_MONTH = new Date(2000, 0, 1);

const MONTH_LABELS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

/**
 * Сколько уходит в месяц.
 *
 * Отдельно от страницы, потому что у разреза свой период - месяцами, а не
 * днями, - свой запрос и своя разметка; ветка внутри страницы сделала бы её
 * третьим экраном в одном файле.
 */
@Component({
  selector: 'app-monthly-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IconComponent, MoneyPipe],
  templateUrl: './monthly-report.component.html',
  styleUrl: './monthly-report.component.scss',
})
export class MonthlyReportComponent {
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);

  readonly currencyId = input.required<string>();
  readonly currencyCode = input<string>('');

  /** Общий со страницей фильтр: трата обязана нести все эти теги. */
  readonly tagIds = input<readonly string[]>([]);

  protected readonly status = signal<Status>('loading');
  protected readonly range = signal<MonthlyRange>('year');
  protected readonly analytics = signal<MonthlyAnalytics | null>(null);

  /** Теги, по которым трата считается регулярной. Достаточно любого из них. */
  protected readonly regularTags = signal<readonly TagFilterItem[]>([]);

  /** Отсекает ответ на устаревший запрос при быстрой смене периода. */
  private generation = 0;

  protected readonly ranges: readonly { id: MonthlyRange; label: string }[] = [
    { id: 'year', label: '12 месяцев' },
    { id: 'twoYears', label: '24 месяца' },
    { id: 'all', label: 'Всё время' },
  ];

  protected readonly months = computed<readonly MonthColumn[]>(() => {
    const data = this.analytics();
    if (!data) {
      return [];
    }

    const scale = data.months.reduce((max, item) => Math.max(max, item.totalAmount), 0);

    return data.months.map((item, index) => {
      const previous = data.months[index - 1];

      return {
        key: `${item.year}-${item.month}`,
        label: MONTH_LABELS[item.month - 1] ?? String(item.month),
        yearLabel: !previous || previous.year !== item.year ? String(item.year) : null,
        totalAmount: item.totalAmount,
        regularAmount: item.regularAmount,
        oneTimeAmount: item.oneTimeAmount,
        regularHeight: heightOf(item.regularAmount, scale),
        oneTimeHeight: heightOf(item.oneTimeAmount, scale),
      };
    });
  });

  /** Высота линии медианы, в процентах от самого дорогого месяца. */
  protected readonly medianHeight = computed(() => {
    const data = this.analytics();
    if (!data) {
      return 0;
    }

    const scale = data.months.reduce((max, item) => Math.max(max, item.totalAmount), 0);

    return heightOf(data.total.median, scale);
  });

  protected readonly summaryRows = computed<readonly SummaryRow[]>(() => {
    const data = this.analytics();
    if (!data) {
      return [];
    }

    return [
      {
        label: 'Среднее',
        total: { amount: data.total.average, month: null },
        regular: { amount: data.regular.average, month: null },
        oneTime: { amount: data.oneTime.average, month: null },
      },
      {
        label: 'Медиана',
        total: { amount: data.total.median, month: null },
        regular: { amount: data.regular.median, month: null },
        oneTime: { amount: data.oneTime.median, month: null },
      },
      {
        label: 'Минимум',
        total: extremum(data.total, 'min'),
        regular: extremum(data.regular, 'min'),
        oneTime: extremum(data.oneTime, 'min'),
      },
      {
        label: 'Максимум',
        total: extremum(data.total, 'max'),
        regular: extremum(data.regular, 'max'),
        oneTime: extremum(data.oneTime, 'max'),
      },
    ];
  });

  /** Доля регулярного в расходах за весь ряд, в процентах. */
  protected readonly regularShare = computed(() => {
    const data = this.analytics();
    if (!data) {
      return 0;
    }

    const total = data.total.average;

    return total > 0 ? Math.round((data.regular.average / total) * 100) : 0;
  });

  protected readonly breakdownRows = computed<readonly BreakdownRow[]>(() => {
    const data = this.analytics();
    if (!data) {
      return [];
    }

    const visible = data.regularBreakdown.filter(
      (item) => item.averageAmount >= MIN_VISIBLE_AMOUNT,
    );
    const scale = visible.reduce((max, item) => Math.max(max, item.averageAmount), 0);

    return visible.map((item, index) => ({
      key: item.scheduleId ?? `tagged-${index}`,
      title:
        item.description ??
        (item.scheduleId ? 'Удалённое расписание' : 'Помечено тегом, без расписания'),
      isTagged: item.scheduleId === null,
      amount: item.averageAmount,
      width: scale > 0 ? Math.max(2, Math.round((item.averageAmount / scale) * 100)) : 0,
    }));
  });

  protected readonly isEmpty = computed(
    () => this.status() === 'ready' && this.months().length === 0,
  );

  constructor() {
    effect(() => {
      const currencyId = this.currencyId();
      const range = this.range();
      const tagIds = this.tagIds();
      const regularTagIds = this.regularTags().map((tag) => tag.id);

      this.load(currencyId, range, tagIds, regularTagIds);
    });
  }

  protected selectRange(range: MonthlyRange): void {
    this.range.set(range);
  }

  protected addRegularTag(): void {
    this.sheets
      .openSheet<TagPickerResult, TagPickerData>(
        TagPickerSheet,
        { excludedIds: this.regularTags().map((tag) => tag.id), allowCreate: false },
        { ariaLabel: 'Тег регулярных трат' },
      )
      .closed.subscribe((result) => {
        // Новый тег здесь бесполезен: под ним ещё нет ни одной траты, а значит
        // и регулярным он ничего не сделает.
        if (result?.kind !== 'existing') {
          return;
        }

        this.regularTags.update((current) => [...current, result.tag]);
      });
  }

  protected removeRegularTag(tag: TagFilterItem): void {
    this.regularTags.update((current) => current.filter((item) => item.id !== tag.id));
  }

  protected retry(): void {
    this.load(
      this.currencyId(),
      this.range(),
      this.tagIds(),
      this.regularTags().map((tag) => tag.id),
    );
  }

  private load(
    currencyId: string,
    range: MonthlyRange,
    tagIds: readonly string[],
    regularTagIds: readonly string[],
  ): void {
    this.status.set('loading');

    const generation = ++this.generation;
    const isStale = (): boolean => generation !== this.generation;
    const { from, to } = monthRange(range);

    this.api
      .getMonthlyAnalytics(from, to, currencyId, tagIds, regularTagIds)
      .subscribe({
        next: (analytics) => {
          if (isStale()) {
            return;
          }

          this.analytics.set(analytics);
          this.status.set('ready');
        },
        error: () => {
          if (!isStale()) {
            this.status.set('error');
          }
        },
      });
  }
}

/**
 * Границы ряда.
 *
 * Верхняя - текущий месяц, хотя в ряд он не войдёт: его выкидывает сервер, и
 * повторять это правило здесь значит завести второе место, где оно живёт.
 */
function monthRange(range: MonthlyRange): { from: Date; to: Date } {
  const today = new Date();
  const to = new Date(today.getFullYear(), today.getMonth(), 1);

  switch (range) {
    case 'year':
      return { from: new Date(today.getFullYear(), today.getMonth() - 12, 1), to };

    case 'twoYears':
      return { from: new Date(today.getFullYear(), today.getMonth() - 24, 1), to };

    case 'all':
      return { from: EARLIEST_MONTH, to };
  }
}

function heightOf(amount: number, scale: number): number {
  return scale > 0 ? Math.max(0, (amount / scale) * 100) : 0;
}

/**
 * Крайний месяц разреза.
 *
 * Сумма остаётся всегда, а подпись месяца пропадает на ровном ряде: там
 * минимум и максимум приходятся на один и тот же месяц - сервер из равных
 * берёт самый ранний, - и две одинаковые подписи выглядели бы как ошибка.
 */
function extremum(summary: MonthlyAnalyticsSummary, kind: 'min' | 'max'): SummaryCell {
  const { min, max } = summary;
  const value = kind === 'min' ? min : max;
  if (!value) {
    return { amount: 0, month: null };
  }

  const isFlat = min !== null && max !== null && min.amount === max.amount;

  return { amount: value.amount, month: isFlat ? null : monthLabel(value) };
}

function monthLabel(value: MonthlyAnalyticsExtremum): string {
  return `${MONTH_LABELS[value.month - 1] ?? value.month} ${value.year}`;
}
