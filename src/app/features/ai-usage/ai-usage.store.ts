import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { AiUsageApiService } from '../../domain/api/ai-usage-api.service';
import {
  AiCallSiteDto,
  AiSettingsDto,
  AiUsageLogItemDto,
  AiUsagePeriodDto,
  AiUsageSummaryDto,
  UpdateAiSettingsDto,
} from '../../domain/dto/ai-usage.dto';

/** Сколько строк журнала запрашивается за раз. Потолок эндпоинта - 200. */
const PAGE_SIZE = 25;

export type AiUsageStatus = 'loading' | 'ready' | 'error';

/**
 * Раздел расхода на ИИ: итоги, страница журнала и настройки мест вызова.
 *
 * Итоги и журнал считаются по одному и тому же журналу обращений, поэтому
 * период у них общий: разъехавшийся период показывал бы сумму за одно окно и
 * строки за другое.
 */
@Injectable()
export class AiUsageStore {
  private readonly api = inject(AiUsageApiService);

  private readonly periodSignal = signal<AiUsagePeriodDto>('Last30Days');
  private readonly callSiteSignal = signal<AiCallSiteDto | null>(null);
  private readonly userIdSignal = signal<string | null>(null);

  private readonly summarySignal = signal<AiUsageSummaryDto | null>(null);
  private readonly settingsSignal = signal<AiSettingsDto | null>(null);
  private readonly itemsSignal = signal<readonly AiUsageLogItemDto[]>([]);
  private readonly cursorSignal = signal<string | null>(null);
  private readonly statusSignal = signal<AiUsageStatus>('loading');
  private readonly loadingMoreSignal = signal(false);
  private readonly savingSignal = signal(false);

  /**
   * Номер поколения запроса: ответ на сменённый период не должен перетирать
   * актуальные данные - иначе экран расходится с выбранным периодом.
   */
  private generation = 0;

  readonly period = this.periodSignal.asReadonly();
  readonly callSite = this.callSiteSignal.asReadonly();
  readonly userId = this.userIdSignal.asReadonly();
  readonly summary = this.summarySignal.asReadonly();
  readonly settings = this.settingsSignal.asReadonly();
  readonly items = this.itemsSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly isLoadingMore = this.loadingMoreSignal.asReadonly();
  readonly isSaving = this.savingSignal.asReadonly();

  readonly hasMore = computed(() => this.cursorSignal() !== null);

  readonly isEmpty = computed(
    () => this.statusSignal() === 'ready' && this.itemsSignal().length === 0,
  );

  async load(): Promise<void> {
    const generation = ++this.generation;
    this.statusSignal.set('loading');

    try {
      const [summary, page, settings] = await Promise.all([
        this.request(() => this.api.getSummary(this.periodSignal())),
        this.request(() =>
          this.api.getLog({
            period: this.periodSignal(),
            callSite: this.callSiteSignal(),
            userId: this.userIdSignal(),
            cursor: null,
            count: PAGE_SIZE,
          }),
        ),
        this.request(() => this.api.getSettings()),
      ]);

      if (generation !== this.generation) {
        return;
      }

      this.summarySignal.set(summary);
      this.settingsSignal.set(settings);
      this.itemsSignal.set(page.items);
      this.cursorSignal.set(page.nextCursor ?? null);
      this.statusSignal.set('ready');
    } catch {
      if (generation === this.generation) {
        this.statusSignal.set('error');
      }
    }
  }

  async loadMore(): Promise<void> {
    const cursor = this.cursorSignal();
    if (cursor === null || this.loadingMoreSignal()) {
      return;
    }

    const generation = this.generation;
    this.loadingMoreSignal.set(true);

    try {
      const page = await this.request(() =>
        this.api.getLog({
          period: this.periodSignal(),
          callSite: this.callSiteSignal(),
          userId: this.userIdSignal(),
          cursor,
          count: PAGE_SIZE,
        }),
      );

      if (generation !== this.generation) {
        return;
      }

      this.itemsSignal.update((items) => [...items, ...page.items]);
      this.cursorSignal.set(page.nextCursor ?? null);
    } catch {
      // Сбой подгрузки не трогает уже показанное: страница остаётся на экране, кнопка
      // разблокируется, и нажатие можно повторить. О самом сбое сообщает перехватчик ошибок -
      // вторая строка о том же на экране ничего бы не добавила.
    } finally {
      this.loadingMoreSignal.set(false);
    }
  }

  setPeriod(period: AiUsagePeriodDto): void {
    if (period === this.periodSignal()) {
      return;
    }

    this.periodSignal.set(period);
    void this.load();
  }

  setFilters(callSite: AiCallSiteDto | null, userId: string | null): void {
    this.callSiteSignal.set(callSite);
    this.userIdSignal.set(userId);
    void this.load();
  }

  async save(settings: UpdateAiSettingsDto): Promise<boolean> {
    this.savingSignal.set(true);

    try {
      await this.request(() => this.api.updateSettings(settings));
      await this.load();

      return true;
    } catch {
      return false;
    } finally {
      this.savingSignal.set(false);
    }
  }

  private request<T>(call: () => Observable<T>): Promise<T> {
    return firstValueFrom(call());
  }
}
