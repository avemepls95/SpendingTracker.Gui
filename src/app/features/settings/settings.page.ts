import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { TokenStorageService } from '../../core/auth/token-storage.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { SheetService } from '../../core/ui/sheet.service';
import { flagImageUrl } from '../../domain/currency/flag.util';
import { Currency } from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { UserSettingsStore } from '../../domain/stores/user-settings.store';
import { confirmAction } from '../../shared/ui/confirm.dialog';
import {
  CurrencyPickerData,
  CurrencyPickerSheet,
} from '../../shared/ui/currency-picker.sheet';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { HideOnErrorDirective } from '../../shared/util/hide-on-error.directive';
import { MarkupGuideData, MarkupGuideSheet } from '../help/markup-guide.sheet';
import { AiMarkupSheet } from './ai-markup.sheet';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, HideOnErrorDirective],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly settings = inject(UserSettingsStore);
  private readonly currencies = inject(CurrenciesStore);
  private readonly sheets = inject(SheetService);
  private readonly telegram = inject(TelegramService);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(TokenStorageService);

  protected readonly isSaving = this.settings.isSaving;
  protected readonly profile = this.storage.profile;

  // Ссылка на аватар в Telegram живёт не вечно: при сбое загрузки
  // показываем первую букву имени вместо значка битой картинки.
  protected readonly avatarFailed = signal(false);

  /** Выход прячется в Mini App: сессией там управляет сам Telegram. */
  protected readonly canSignOut = !this.telegram.isMiniApp;

  protected readonly currency = computed<Currency | null>(() =>
    this.currencies.find(this.settings.viewCurrencyId()),
  );

  protected readonly currencyFlag = computed(() => {
    const currency = this.currency();
    return currency ? flagImageUrl(currency.flagEmojiCode) : null;
  });

  protected readonly isAiMarkupBlocked = this.settings.isAiMarkupBlocked;

  protected readonly aiMarkupStatus = computed(() => {
    if (!this.settings.aiMarkupUserConsent()) {
      return 'Выключена';
    }

    return this.isAiMarkupBlocked() ? 'Нет лимита' : 'Включена';
  });

  protected pickCurrency(): void {
    this.sheets
      .openSheet<Currency, CurrencyPickerData>(
        CurrencyPickerSheet,
        { selectedId: this.settings.viewCurrencyId() },
        { ariaLabel: 'Выбор валюты' },
      )
      .closed.subscribe((currency) => {
        if (currency && currency.id !== this.settings.viewCurrencyId()) {
          // Сохраняется сразу: отдельная кнопка «Сохранить» ради одного
          // поля заставляла возвращаться к экрану вторым действием.
          this.settings.setViewCurrency(currency.id);
        }
      });
  }

  protected openGuide(): void {
    this.sheets.openSheet<void, MarkupGuideData>(
      MarkupGuideSheet,
      { section: 'basics' },
      { ariaLabel: 'Как размечать траты' },
    );
  }

  protected openAiMarkup(): void {
    this.sheets.openSheet<void, undefined>(AiMarkupSheet, undefined, {
      ariaLabel: 'Автоматическая разметка',
    });
  }

  protected async signOut(): Promise<void> {
    const confirmed = await confirmAction(this.sheets, this.telegram, {
      title: 'Выйти из аккаунта?',
      message: 'Данные останутся на сервере. Чтобы вернуться, войдите через Telegram.',
      confirmLabel: 'Выйти',
    });

    if (confirmed) {
      this.auth.signOut();
    }
  }
}
