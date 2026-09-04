import { Injectable, computed, inject, signal } from '@angular/core';

import { SpendingApiService } from '../../domain/api/spending-api.service';
import { MarkupEntry, MarkupVerdict } from '../../domain/models/models';

/** Сколько записей запрашивается за раз. Потолок эндпоинта - 200. */
const PAGE_SIZE = 25;

export type ListStatus = 'loading' | 'ready' | 'error';

/**
 * Словарь разметки: страница записей под фильтром по вердикту.
 *
 * Умолчание фильтра - догадки модели: именно их человек и приходит
 * просматривать. Эндпоинт по умолчанию отдаёт все вердикты, умолчание задаёт
 * интерфейс.
 */
@Injectable()
export class MarkupDictionaryStore {
  private readonly api = inject(SpendingApiService);

  private readonly items = signal<readonly MarkupEntry[]>([]);
  private readonly statusSignal = signal<ListStatus>('loading');
  private readonly loadingMoreSignal = signal(false);
  private readonly totalCountSignal = signal(0);

  /** null - записи со всеми вердиктами. */
  private readonly verdictSignal = signal<MarkupVerdict | null>('AssignedByModel');

  /**
   * Номер поколения запроса: ответ на смененный фильтр не должен перетирать
   * актуальный список - иначе он расходится с выделенным чипом до перезагрузки.
   */
  private generation = 0;

  /** Запрос уже отправлен: возврат на раздел не должен прятать список скелетоном. */
  private requested = false;

  readonly status = this.statusSignal.asReadonly();
  readonly isLoadingMore = this.loadingMoreSignal.asReadonly();
  readonly entries = this.items.asReadonly();
  readonly verdict = this.verdictSignal.asReadonly();

  /** Всего записей под текущим фильтром, а не на загруженных страницах. */
  readonly totalCount = this.totalCountSignal.asReadonly();

  readonly hasMore = computed(() => this.items().length < this.totalCountSignal());

  readonly isEmpty = computed(
    () => this.statusSignal() === 'ready' && this.items().length === 0,
  );

  ensureLoaded(): void {
    if (!this.requested) {
      this.reload();
    }
  }

  reload(): void {
    this.requested = true;
    this.statusSignal.set('loading');

    this.fetch(0, (page) => this.items.set(page));
  }

  loadMore(): void {
    if (this.loadingMoreSignal() || !this.hasMore() || this.statusSignal() !== 'ready') {
      return;
    }

    this.loadingMoreSignal.set(true);
    this.fetch(this.items().length, (page) =>
      this.items.update((current) => [...current, ...page]),
    );
  }

  setVerdict(verdict: MarkupVerdict | null): void {
    if (verdict === this.verdictSignal()) {
      return;
    }

    this.verdictSignal.set(verdict);
    this.reload();
  }

  /**
   * Применяет к записи вердикт, в который её перевела операция.
   *
   * Сервер после подтверждения и отказа новую запись не возвращает, но переход
   * известен из таблицы вердиктов: подтверждение даёт AssignedByUser с той же
   * категорией, отказ - RejectedByUser с пустой категорией. Перезапрашивать
   * страницу ради одной строки нельзя: догрузка сбросилась бы вместе с местом
   * в списке, а записей после первого прогона сотни.
   */
  applyVerdictLocally(id: string, verdict: MarkupVerdict): void {
    const filter = this.verdictSignal();

    // Запись выпала из текущего фильтра - убираем её из списка вместе с
    // единицей общего счётчика: он считается под тем же фильтром.
    if (filter !== null && filter !== verdict) {
      this.removeLocally(id);
      return;
    }

    this.items.update((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              verdict,
              category: verdict === 'AssignedByUser' ? entry.category : null,
            }
          : entry,
      ),
    );
  }

  removeLocally(id: string): void {
    const existed = this.items().some((entry) => entry.id === id);
    if (!existed) {
      return;
    }

    this.items.update((current) => current.filter((entry) => entry.id !== id));
    this.totalCountSignal.update((count) => Math.max(0, count - 1));
  }

  private fetch(offset: number, apply: (page: readonly MarkupEntry[]) => void): void {
    const generation = ++this.generation;

    this.api
      .getMarkups({ offset, count: PAGE_SIZE, verdict: this.verdictSignal() })
      .subscribe({
        next: (page) => {
          if (generation !== this.generation) {
            return;
          }

          apply(page.items);
          this.totalCountSignal.set(page.totalCount);
          this.statusSignal.set('ready');
          this.loadingMoreSignal.set(false);
        },
        error: () => {
          if (generation !== this.generation) {
            return;
          }

          // Снимаем отметку запроса, чтобы возврат на раздел попробовал снова,
          // а не показывал ошибку до перезагрузки страницы.
          if (offset === 0) {
            this.requested = false;
            this.statusSignal.set('error');
          } else {
            this.statusSignal.set('ready');
          }

          this.loadingMoreSignal.set(false);
        },
      });
  }
}
