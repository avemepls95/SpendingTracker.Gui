import { Injectable, computed, inject, signal } from '@angular/core';

import { SpendingApiService } from '../api/spending-api.service';
import { Currency } from '../models/models';

/**
 * Справочник валют.
 *
 * Загружается один раз за сеанс. Наружу отдаёт сигналы, поэтому экраны,
 * отрисованные до прихода справочника, перерисуются сами.
 */
@Injectable({ providedIn: 'root' })
export class CurrenciesStore {
  private readonly api = inject(SpendingApiService);

  private readonly items = signal<readonly Currency[]>([]);
  private readonly loaded = signal(false);
  private requested = false;

  readonly currencies = this.items.asReadonly();
  readonly isLoaded = this.loaded.asReadonly();

  private readonly index = computed(
    () => new Map(this.items().map((currency) => [currency.id, currency])),
  );

  load(): void {
    if (this.requested) {
      return;
    }

    this.requested = true;
    this.api.getCurrencies().subscribe({
      next: (currencies) => {
        this.items.set(currencies);
        this.loaded.set(true);
      },
      // Ошибку уже показал errorInterceptor. Снимаем флаг, чтобы попытку
      // можно было повторить, а не залипнуть в вечной загрузке.
      error: () => (this.requested = false),
    });
  }

  /**
   * Валюта по идентификатору или null.
   *
   * Прежний вариант возвращал `map.get(id)!`, и шаблон сразу обращался к
   * `.code`. Список трат приходит раньше справочника, поэтому обращение к
   * несуществующей валюте роняло отрисовку.
   */
  find(id: string): Currency | null {
    return this.index().get(id) ?? null;
  }

  /** Код валюты для показа. Пустая строка, пока справочник не пришёл. */
  codeOf(id: string): string {
    return this.find(id)?.code ?? '';
  }
}
