import { DOCUMENT, Injectable, inject } from '@angular/core';

import { TelegramService } from '../telegram/telegram.service';

/** Фон приложения. Совпадает с токеном --c-bg. */
const APP_BACKGROUND = '#ffffff';

/**
 * Оформление приложения.
 *
 * Тема одна - светлая, в том числе внутри Telegram с тёмным оформлением.
 * Поэтому цвета клиента не читаются, но шапка и фон самого клиента красятся
 * под приложение: иначе над светлым содержимым висит чужая тёмная полоса и
 * выглядит как вторая панель заголовка.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly telegram = inject(TelegramService);

  constructor() {
    this.document.documentElement.dataset['theme'] = 'light';
    this.telegram.applyChromeColor(APP_BACKGROUND);
  }
}
