import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import {
  CategoryAnalytics,
  CategoryAnalyticsItem,
  Tag,
  TagAnalytics,
} from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { UserSettingsStore } from '../../domain/stores/user-settings.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import {
  TagPickerData,
  TagPickerResult,
  TagPickerSheet,
} from '../../shared/ui/tag-picker.sheet';
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

/** Разрез отчёта: дерево категорий или плоский список тегов. */
export type AnalyticsView = 'categories' | 'tags';

interface Period {
  readonly from: Date;
  readonly to: Date;
}

/** Строка диаграммы: узел дерева, приведённый к плоскому виду. */
export interface BarRow {
  /**
   * Путь от корня до узла.
   *
   * Ключ строится путём, а не идентификатором: одна и та же категория может
   * встретиться в разных ветках отчёта, и по идентификатору строки были бы
   * неразличимы для @for и для состояния раскрытия.
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

/** Строка разреза по тегам. */
export interface TagRow {
  readonly tagId: string;
  readonly title: string;
  readonly group: string | null;
  readonly amount: number;
  readonly share: number;
  readonly width: number;
  readonly isSelected: boolean;
}

/**
 * Тег в фильтре отчёта.
 *
 * Уже полного тега намеренно: фильтр набирается и из выбора тегов, и нажатием
 * по строке отчёта, а у строки отчёта есть только идентификатор с подписью.
 * Остальные поля тега здесь не нужны, и подставлять им умолчания - значит
 * выдавать выдумку за состояние тега.
 */
type TagFilterItem = Pick<Tag, 'id' | 'title'>;

/** Суммы ниже копейки в отчёте - шум округления, а не траты. */
const MIN_VISIBLE_AMOUNT = 0.01;

/** Пауза между правкой даты и запросом отчёта. */
const DATE_INPUT_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-analytics-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent, IconComponent, MoneyPipe, RouterLink],
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.scss',
})
export class AnalyticsPage implements OnDestroy {
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);
  private readonly settings = inject(UserSettingsStore);
  private readonly currencies = inject(CurrenciesStore);

  protected readonly status = signal<Status>('loading');
  protected readonly preset = signal<PeriodPreset>('month');
  protected readonly view = signal<AnalyticsView>('categories');
  protected readonly analytics = signal<CategoryAnalytics | null>(null);
  protected readonly tagAnalytics = signal<TagAnalytics | null>(null);

  /** Фильтр по тегам: учитываются траты, несущие все выбранные теги. */
  protected readonly selectedTags = signal<readonly TagFilterItem[]>([]);

  private readonly customFrom = signal(formatInputDate(addDays(new Date(), -30)));
  private readonly customTo = signal(formatInputDate(new Date()));
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  /** Отсекает ответ на устаревший запрос при быстрой смене периода. */
  private generation = 0;

  /**
   * Нативное поле даты шлёт событие на каждый изменённый сегмент - день,
   * месяц, год. Без паузы отчёт перезапрашивался бы трижды подряд, и один из
   * промежуточных ответов мог прийти последним.
   *
   * Таймеры у полей раздельные: общий отменял бы ещё не применённую правку
   * начала периода, когда пользователь сразу переходит к его концу.
   */
  private readonly dateTimers: {
    from?: ReturnType<typeof setTimeout>;
    to?: ReturnType<typeof setTimeout>;
  } = {};

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

  protected readonly total = computed(() =>
    this.view() === 'categories'
      ? (this.analytics()?.totalAmount ?? 0)
      : (this.tagAnalytics()?.totalAmount ?? 0),
  );

  protected readonly untaggedAmount = computed(
    () => this.tagAnalytics()?.untaggedAmount ?? 0,
  );

  /** За период есть траты, но ни одна не отнесена к категории. */
  protected readonly hasUncategorizedOnly = computed(() => {
    const data = this.analytics();

    return (
      this.view() === 'categories' &&
      data !== null &&
      data.totalAmount > MIN_VISIBLE_AMOUNT &&
      visibleRoots(data.categories).length === 0
    );
  });

  /** В разрезе по тегам за период есть траты, но ни на одной нет тега. */
  protected readonly hasUntaggedOnly = computed(() => {
    const data = this.tagAnalytics();

    return (
      this.view() === 'tags' &&
      data !== null &&
      data.totalAmount > MIN_VISIBLE_AMOUNT &&
      data.tags.length === 0
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

  protected readonly tagRows = computed<readonly TagRow[]>(() => {
    const data = this.tagAnalytics();
    if (!data) {
      return [];
    }

    const visible = data.tags.filter((item) => item.amount >= MIN_VISIBLE_AMOUNT);
    const scale = visible.reduce((max, item) => Math.max(max, item.amount), 0);
    const total = data.totalAmount || 1;
    const selectedIds = new Set(this.selectedTags().map((tag) => tag.id));

    return visible.map((item) => ({
      tagId: item.tagId,
      title: item.tagTitle,
      group: item.group,
      amount: item.amount,
      share: Math.round((item.amount / total) * 100),
      width: scale > 0 ? Math.max(2, Math.round((item.amount / scale) * 100)) : 0,
      isSelected: selectedIds.has(item.tagId),
    }));
  });

  constructor() {
    // Перезагрузка при смене периода, валюты сводки, разреза и фильтра.
    effect(() => {
      const currencyId = this.settings.viewCurrencyId();
      const period = this.period();
      const view = this.view();
      const tagIds = this.selectedTags().map((tag) => tag.id);

      if (currencyId) {
        this.load(period, currencyId, view, tagIds);
        return;
      }

      if (this.settings.isLoaded()) {
        this.status.set('no-currency');
      }
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.dateTimers.from);
    clearTimeout(this.dateTimers.to);
  }

  protected selectPreset(preset: PeriodPreset): void {
    this.preset.set(preset);
  }

  protected selectView(view: AnalyticsView): void {
    this.view.set(view);
  }

  protected onFrom(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.scheduleDateChange('from', () => this.customFrom.set(value));
  }

  protected onTo(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.scheduleDateChange('to', () => this.customTo.set(value));
  }

  // ------------------------------------------------------------ фильтр

  protected addTagFilter(): void {
    this.sheets
      .openSheet<TagPickerResult, TagPickerData>(
        TagPickerSheet,
        { excludedIds: this.selectedTags().map((tag) => tag.id) },
        { ariaLabel: 'Фильтр по тегу' },
      )
      .closed.subscribe((result) => {
        // Отчёт фильтруется существующими тегами, поэтому создание нового
        // здесь смысла не имеет: под него ещё нет ни одной траты.
        if (result?.kind !== 'existing') {
          return;
        }

        this.selectedTags.update((current) => [...current, result.tag]);
      });
  }

  protected removeTagFilter(tag: TagFilterItem): void {
    this.selectedTags.update((current) =>
      current.filter((item) => item.id !== tag.id),
    );
  }

  /** Нажатие на строку тега сужает отчёт до этого тега. */
  protected toggleTagFilter(row: TagRow): void {
    if (row.isSelected) {
      this.selectedTags.update((current) =>
        current.filter((item) => item.id !== row.tagId),
      );

      return;
    }

    this.selectedTags.update((current) => [
      ...current,
      { id: row.tagId, title: row.title },
    ]);
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
      this.load(
        this.period(),
        currencyId,
        this.view(),
        this.selectedTags().map((tag) => tag.id),
      );

      return;
    }

    this.status.set('loading');
    this.settings.reload();
  }

  private scheduleDateChange(field: 'from' | 'to', apply: () => void): void {
    clearTimeout(this.dateTimers[field]);
    this.dateTimers[field] = setTimeout(apply, DATE_INPUT_DEBOUNCE_MS);
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

  private load(
    period: Period,
    currencyId: string,
    view: AnalyticsView,
    tagIds: readonly string[],
  ): void {
    this.status.set('loading');

    const generation = ++this.generation;
    const isStale = (): boolean => generation !== this.generation;

    if (view === 'tags') {
      this.api.getTagsAnalytics(period.from, period.to, currencyId, tagIds).subscribe({
        next: (analytics) => {
          if (isStale()) {
            return;
          }

          this.tagAnalytics.set(analytics);
          this.status.set('ready');
        },
        error: () => {
          if (!isStale()) {
            this.status.set('error');
          }
        },
      });

      return;
    }

    this.api
      .getCategoriesAnalytics(period.from, period.to, currencyId, tagIds)
      .subscribe({
        next: (analytics) => {
          if (isStale()) {
            return;
          }

          this.analytics.set(analytics);
          this.expanded.set(new Set());
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
