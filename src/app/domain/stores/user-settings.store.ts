import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../api/spending-api.service';
import { UserSettings } from '../models/models';

/**
 * Настройки пользователя.
 *
 * Валюта отображения хранится сигналом, поэтому экраны счетов и аналитики
 * пересчитываются сразу после её смены. Прежняя реализация связывала настройки
 * и справочник через zip(): оператор ждёт по одному значению из каждого
 * источника, второе изменение настроек до экранов уже не доходило и данные
 * обновлялись только после перезагрузки страницы.
 */
@Injectable({ providedIn: 'root' })
export class UserSettingsStore {
  private readonly api = inject(SpendingApiService);
  private readonly toast = inject(ToastService);

  private readonly state = signal<UserSettings>({
    viewCurrencyId: '',
    aiMarkupUserConsent: false,
    aiMarkupMonthlyLimit: 0,
  });

  private readonly loaded = signal(false);
  private readonly saving = signal(false);
  private requested = false;

  readonly settings = this.state.asReadonly();

  /** Ответ сервера получен: до этого пустая валюта ничего не означает. */
  readonly isLoaded = this.loaded.asReadonly();
  readonly isSaving = this.saving.asReadonly();

  /** Валюта, в которой сводятся суммы. Пустая строка - валюта не выбрана. */
  readonly viewCurrencyId = computed(() => this.state().viewCurrencyId);

  /** Разрешение отправлять описания трат в языковую модель. */
  readonly aiMarkupUserConsent = computed(() => this.state().aiMarkupUserConsent);

  /**
   * Месячный лимит обращений к модели. Правится владельцем сервиса в базе,
   * отсюда только читается.
   */
  readonly aiMarkupMonthlyLimit = computed(() => this.state().aiMarkupMonthlyLimit);

  /**
   * Согласие выдано, но лимит нулевой - разметки не будет.
   *
   * Условие живёт здесь, а не на экранах: его показывают и строка настроек, и
   * лист согласия, и разойтись они не должны.
   */
  readonly isAiMarkupBlocked = computed(
    () => this.state().aiMarkupUserConsent && this.state().aiMarkupMonthlyLimit === 0,
  );

  load(): void {
    if (this.requested) {
      return;
    }

    this.reload();
  }

  /** Повторная попытка после сбоя. */
  reload(): void {
    this.requested = true;

    this.api.getUserSettings().subscribe({
      next: (settings) => {
        this.state.set(settings);
        this.loaded.set(true);
      },
      // Сообщение показал errorInterceptor. Снимаем отметку о запросе,
      // чтобы попытку можно было повторить, а не залипнуть навсегда.
      error: () => (this.requested = false),
    });
  }

  /** Валюта, в которой сводятся суммы на экранах счетов и аналитики. */
  setViewCurrency(currencyId: string): void {
    this.save({ ...this.state(), viewCurrencyId: currencyId }, { withConsent: false });
  }

  /**
   * Разрешение отправлять описания трат в языковую модель.
   *
   * Согласие уходит на сервер только этим путём: в остальных запросах поле
   * опущено, и уже выданное согласие они не отзывают.
   */
  setAiMarkupConsent(value: boolean): void {
    this.save({ ...this.state(), aiMarkupUserConsent: value }, { withConsent: true });
  }

  private save(settings: UserSettings, options: { withConsent: boolean }): void {
    const previous = this.state();

    // Новое значение показывается сразу, но при отказе сервера откатывается:
    // иначе интерфейс считает в валюте, которой на сервере нет, а счета и
    // аналитика молча пересчитываются по несохранённой настройке.
    this.state.set(settings);
    this.saving.set(true);

    this.api
      .updateUserSettings({
        viewCurrencyId: settings.viewCurrencyId,
        aiMarkupUserConsent: options.withConsent
          ? settings.aiMarkupUserConsent
          : undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.toast.success('Сохранено'),
        error: () => this.state.set(previous),
      });
  }
}
