import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeRu from '@angular/common/locales/ru';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideAppInitializer,
  provideZonelessChangeDetection,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { TelegramService } from './core/telegram/telegram.service';
import { ThemeService } from './core/theme/theme.service';

registerLocaleData(localeRu);

export const appConfig: ApplicationConfig = {
  providers: [
    // Приложение работает без zone.js: состояние держат сигналы, они же
    // и запускают перерисовку.
    provideZonelessChangeDetection(),

    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),

    // authInterceptor стоит первым, поэтому ответ проходит через него
    // последним и он успевает продлить сессию до показа ошибки.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),

    { provide: LOCALE_ID, useValue: 'ru' },

    provideAppInitializer(() => {
      inject(TelegramService).initialize();
      // Тема поднимается сразу: иначе первый кадр успевает мигнуть светлым
      // фоном внутри тёмного Telegram.
      inject(ThemeService);
    }),
  ],
};
