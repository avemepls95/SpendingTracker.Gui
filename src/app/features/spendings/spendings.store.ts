import { Injectable, computed, inject, signal } from '@angular/core';

import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Spending } from '../../domain/models/models';
import { dayKey, formatDayLabel, parseCalendarDate } from '../../shared/util/date.util';

/** Сколько записей запрашивается за раз. */
const PAGE_SIZE = 25;

export type ListStatus = 'loading' | 'ready' | 'error';

export interface CurrencyTotal {
  readonly currencyId: string;
  readonly amount: number;
}

export interface DayGroup {
  readonly key: string;
  readonly label: string;
  readonly totals: readonly CurrencyTotal[];
  readonly items: readonly Spending[];
}

/**
 * Список трат: загрузка, фильтры и постраничная догрузка.
 *
 * Состояние вынесено из компонента, потому что тем же списком пользуются
 * шит редактирования и шит категорий: после правки нужно обновить одну
 * запись, а не перезапрашивать всю страницу.
 */
@Injectable()
export class SpendingsStore {
  private readonly api = inject(SpendingApiService);

  private readonly items = signal<readonly Spending[]>([]);
  private readonly statusSignal = signal<ListStatus>('loading');
  private readonly loadingMoreSignal = signal(false);
  private readonly hasMoreSignal = signal(false);
  private readonly withoutCategoryCountSignal = signal(0);

  private readonly searchSignal = signal('');
  private readonly withoutCategoriesSignal = signal(false);

  /**
   * Номер поколения запроса.
   *
   * Быстрое переключение фильтров оставляет в полёте несколько запросов, и
   * ответы приходят в произвольном порядке. Без отметки поколения ответ на
   * отменённый фильтр перетирал бы актуальный список, и он расходился бы с
   * выделенным чипом до следующей перезагрузки.
   */
  private generation = 0;

  readonly status = this.statusSignal.asReadonly();
  readonly isLoadingMore = this.loadingMoreSignal.asReadonly();
  readonly hasMore = this.hasMoreSignal.asReadonly();
  readonly search = this.searchSignal.asReadonly();
  readonly onlyWithoutCategories = this.withoutCategoriesSignal.asReadonly();
  readonly spendings = this.items.asReadonly();

  /**
   * Размер очереди разбора: сколько трат владельца без категории.
   *
   * Считается сервером по всем тратам, а не по загруженной странице и не по
   * строке поиска, поэтому и при включённом фильтре показывает остаток целиком.
   */
  readonly withoutCategoryCount = this.withoutCategoryCountSignal.asReadonly();

  readonly isEmpty = computed(
    () => this.statusSignal() === 'ready' && this.items().length === 0,
  );

  readonly isFiltered = computed(
    () => this.searchSignal().trim() !== '' || this.withoutCategoriesSignal(),
  );

  /** Траты, сгруппированные по дням, в порядке прихода от сервера. */
  readonly groups = computed<readonly DayGroup[]>(() => groupByDay(this.items()));

  reload(): void {
    this.statusSignal.set('loading');
    this.fetch(0, (page) => {
      this.items.set(page);
    });
  }

  loadMore(): void {
    if (this.loadingMoreSignal() || !this.hasMoreSignal() || this.statusSignal() !== 'ready') {
      return;
    }

    this.loadingMoreSignal.set(true);
    this.fetch(this.items().length, (page) => {
      this.items.update((current) => [...current, ...page]);
    });
  }

  setSearch(value: string): void {
    if (value === this.searchSignal()) {
      return;
    }

    this.searchSignal.set(value);
    this.reload();
  }

  setOnlyWithoutCategories(value: boolean): void {
    if (value === this.withoutCategoriesSignal()) {
      return;
    }

    this.withoutCategoriesSignal.set(value);
    this.reload();
  }

  /**
   * Убирает трату из списка по идентификатору.
   *
   * Прежний код запоминал индекс до открытия диалога подтверждения и вызывал
   * splice уже после. Если элемента не находилось, индекс оставался -1,
   * и splice(-1, 1) удалял последнюю запись списка.
   */
  removeLocally(id: string): void {
    const removed = this.items().find((item) => item.id === id);

    this.items.update((current) => current.filter((item) => item.id !== id));

    if (removed && removed.category === null) {
      this.shiftWithoutCategoryCount(-1);
    }
  }

  /**
   * Заменяет трату по идентификатору, сохраняя позицию в списке.
   *
   * Заодно двигает счётчик очереди: разметка правится в карточке отдельными
   * запросами, списка это не касается, и без поправки чип показывал бы прежнее
   * число до следующей полной загрузки.
   */
  replaceLocally(spending: Spending): void {
    const previous = this.items().find((item) => item.id === spending.id);

    this.items.update((current) =>
      current.map((item) => (item.id === spending.id ? spending : item)),
    );

    if (!previous) {
      return;
    }

    const wasWithoutCategory = previous.category === null;
    const isWithoutCategory = spending.category === null;

    if (wasWithoutCategory !== isWithoutCategory) {
      this.shiftWithoutCategoryCount(isWithoutCategory ? 1 : -1);
    }
  }

  private shiftWithoutCategoryCount(delta: number): void {
    this.withoutCategoryCountSignal.update((count) => Math.max(0, count + delta));
  }

  private fetch(offset: number, apply: (page: readonly Spending[]) => void): void {
    const generation = ++this.generation;
    const isStale = (): boolean => generation !== this.generation;

    this.api
      .getSpendings({
        offset,
        count: PAGE_SIZE,
        searchString: this.searchSignal().trim(),
        onlyWithoutCategories: this.withoutCategoriesSignal(),
      })
      .subscribe({
        next: (page) => {
          if (isStale()) {
            return;
          }

          apply(page.items);
          // Полная страница означает, что на сервере может быть продолжение.
          this.hasMoreSignal.set(page.items.length === PAGE_SIZE);
          // Счётчик обновляется и при догрузке: разметка могла измениться в
          // другой вкладке или прийти от фонового процесса, пока список листали.
          this.withoutCategoryCountSignal.set(page.withoutCategoryCount);
          this.statusSignal.set('ready');
          this.loadingMoreSignal.set(false);
        },
        error: () => {
          if (isStale()) {
            return;
          }

          this.statusSignal.set(offset === 0 ? 'error' : 'ready');
          this.loadingMoreSignal.set(false);
        },
      });
  }
}

function groupByDay(spendings: readonly Spending[]): readonly DayGroup[] {
  const groups = new Map<string, { label: string; items: Spending[] }>();

  for (const spending of spendings) {
    const date = parseCalendarDate(spending.date);
    // Записи с неразобранной датой собираются отдельно, а не выпадают из списка.
    const key = date ? dayKey(date) : 'unknown';
    const label = date ? formatDayLabel(date) : 'Без даты';

    const group = groups.get(key);
    if (group) {
      group.items.push(spending);
    } else {
      groups.set(key, { label, items: [spending] });
    }
  }

  return Array.from(groups, ([key, group]) => ({
    key,
    label: group.label,
    totals: sumByCurrency(group.items),
    items: group.items,
  }));
}

/**
 * Итоги дня по каждой валюте отдельно.
 *
 * Складывать рубли с шекелями нельзя, а траты в разных валютах в одном дне -
 * обычное дело.
 */
function sumByCurrency(items: readonly Spending[]): readonly CurrencyTotal[] {
  const totals = new Map<string, number>();

  for (const item of items) {
    totals.set(item.currencyId, (totals.get(item.currencyId) ?? 0) + item.amount);
  }

  return Array.from(totals, ([currencyId, amount]) => ({ currencyId, amount })).sort(
    (left, right) => right.amount - left.amount,
  );
}
