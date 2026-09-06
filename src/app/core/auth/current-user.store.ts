import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { UserApiService } from './user-api.service';

/**
 * Признак администратора текущего пользователя.
 *
 * Спрашивается один раз за сессию и кешируется: иначе запрос уходил бы на
 * каждый переход по маршруту, закрытому проверкой прав. Кеш здесь безопасен -
 * скрытие пункта меню это удобство, а отказ стоит на сервере и читает базу на
 * каждом запросе.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserStore {
  private readonly api = inject(UserApiService);

  private readonly isAdminSignal = signal<boolean | null>(null);
  private pending: Promise<boolean> | null = null;
  private generation = 0;

  /** null - ещё не спрашивали. */
  readonly isAdmin = computed(() => this.isAdminSignal() ?? false);

  async ensureLoaded(): Promise<boolean> {
    const known = this.isAdminSignal();
    if (known !== null) {
      return known;
    }

    // Один запрос на несколько одновременных обращений: guard и страница
    // настроек спрашивают признак независимо друг от друга.
    this.pending ??= this.load();

    return this.pending;
  }

  /**
   * Забывает известный признак: вызывается при выходе, иначе после входа под другой учётной
   * записью пункт меню остался бы от прежней и вёл бы на раздел, который отвечает 404.
   */
  reset(): void {
    this.isAdminSignal.set(null);
    this.pending = null;
    // Поколение растёт, чтобы ответ, начатый до выхода, не выставил признак прежней учётной
    // записи уже после него.
    this.generation++;
  }

  private async load(): Promise<boolean> {
    const generation = this.generation;

    try {
      const response = await firstValueFrom(this.api.getCurrent());

      if (generation !== this.generation) {
        return false;
      }

      this.isAdminSignal.set(response.isAdmin);

      return response.isAdmin;
    } catch {
      // Сеть или сессия: администратором пользователь не считается, но и
      // запомнить этот ответ нельзя - иначе один сбой прячет раздел до
      // перезагрузки приложения.
      this.pending = null;

      return false;
    }
  }
}
