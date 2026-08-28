import { Injectable, computed, inject, signal } from '@angular/core';

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

  private readonly state = signal<UserSettings>({ viewCurrencyId: '' });
  private readonly loaded = signal(false);
  private readonly saving = signal(false);
  private requested = false;

  readonly settings = this.state.asReadonly();
  readonly isLoaded = this.loaded.asReadonly();
  readonly isSaving = this.saving.asReadonly();

  /** Валюта, в которой сводятся суммы. Пустая строка - настройки ещё не пришли. */
  readonly viewCurrencyId = computed(() => this.state().viewCurrencyId);

  load(): void {
    if (this.requested) {
      return;
    }

    this.requested = true;
    this.api.getUserSettings().subscribe({
      next: (settings) => {
        this.state.set(settings);
        this.loaded.set(true);
      },
      error: () => (this.requested = false),
    });
  }

  save(settings: UserSettings): void {
    const previous = this.state();

    // Показываем новое значение сразу, чтобы экран не ждал ответа сервера.
    this.state.set(settings);
    this.saving.set(true);

    this.api.updateUserSettings(settings).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Сохранено');
      },
      error: () => {
        // Сообщение об ошибке показал интерцептор, здесь возвращаем прежнее
        // значение, чтобы интерфейс не расходился с сервером.
        this.state.set(previous);
        this.saving.set(false);
      },
    });
  }
}
