import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

import { localStore } from '../storage/local-storage';
import { TelegramService } from '../telegram/telegram.service';
import { TelegramThemeParams } from '../telegram/telegram-web-app.types';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_MODE_KEY = 'themeMode';

/** Запасные цвета на случай, если клиент прислал неполный набор. */
const FALLBACK_DARK = { bg: '#17191c', surface: '#1f2226', text: '#f0f2f5' };
const FALLBACK_LIGHT = { bg: '#f2f4f7', surface: '#ffffff', text: '#14161a' };

/**
 * Выбирает тему и переносит палитру Telegram в токены приложения.
 *
 * Приоритет источников: явный выбор пользователя, затем оформление Telegram,
 * затем системная настройка браузера.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly telegram = inject(TelegramService);

  private readonly modeSignal = signal<ThemeMode>(readStoredMode());
  private readonly systemDark = signal(prefersDark());

  readonly mode = this.modeSignal.asReadonly();

  /** Итоговая схема с учётом всех источников. */
  readonly resolvedScheme = computed<'light' | 'dark'>(() => {
    const mode = this.modeSignal();
    if (mode !== 'system') {
      return mode;
    }

    return this.telegram.isMiniApp
      ? this.telegram.colorScheme()
      : this.systemDark()
        ? 'dark'
        : 'light';
  });

  constructor() {
    this.watchSystemScheme();

    effect(() => {
      const scheme = this.resolvedScheme();
      const root = this.document.documentElement;

      root.dataset['theme'] = scheme;

      // Палитра Telegram применяется только когда пользователь не выбрал
      // тему вручную: иначе клиент навязал бы свои цвета поверх выбора.
      const useTelegramPalette =
        this.telegram.isMiniApp && this.modeSignal() === 'system';

      if (useTelegramPalette) {
        this.applyTelegramPalette(this.telegram.themeParams(), scheme);
      } else {
        this.clearTelegramPalette();
      }

      this.syncBrowserChrome(scheme);
    });
  }

  setMode(mode: ThemeMode): void {
    this.modeSignal.set(mode);
    localStore.write(THEME_MODE_KEY, mode);
  }

  /**
   * Переносит цвета клиента в базовые токены.
   *
   * Переопределяются только базовые значения: производные - границы, подложки,
   * состояния - посчитаны через color-mix и подтягиваются сами.
   */
  private applyTelegramPalette(
    params: TelegramThemeParams,
    scheme: 'light' | 'dark',
  ): void {
    const fallback = scheme === 'dark' ? FALLBACK_DARK : FALLBACK_LIGHT;
    const style = this.document.documentElement.style;

    // Фон страницы - второстепенный цвет клиента: на нём лежат группы-секции.
    const background =
      params.secondary_bg_color ?? params.bg_color ?? fallback.bg;
    const surface = params.section_bg_color ?? params.bg_color ?? fallback.surface;
    const text = params.text_color ?? fallback.text;

    const set = (token: string, value: string | undefined): void => {
      if (value) {
        style.setProperty(token, value);
      } else {
        style.removeProperty(token);
      }
    };

    set('--c-bg', background);
    set('--c-surface', surface);
    set('--c-surface-2', `color-mix(in srgb, ${text} 8%, ${surface})`);
    set('--c-text', text);
    set('--c-text-2', params.subtitle_text_color ?? params.hint_color);
    set('--c-accent', params.button_color ?? params.link_color);
    set('--c-accent-contrast', params.button_text_color);
    set('--c-danger', params.destructive_text_color);

    this.telegram.applyChromeColor(background);
  }

  private clearTelegramPalette(): void {
    const style = this.document.documentElement.style;
    for (const token of [
      '--c-bg',
      '--c-surface',
      '--c-surface-2',
      '--c-text',
      '--c-text-2',
      '--c-accent',
      '--c-accent-contrast',
      '--c-danger',
    ]) {
      style.removeProperty(token);
    }
  }

  /** Приводит цвет системной строки браузера к фону приложения. */
  private syncBrowserChrome(scheme: 'light' | 'dark'): void {
    const color = scheme === 'dark' ? FALLBACK_DARK.bg : FALLBACK_LIGHT.bg;
    for (const meta of Array.from(
      this.document.querySelectorAll('meta[name="theme-color"]'),
    )) {
      meta.setAttribute('content', color);
      meta.removeAttribute('media');
    }
  }

  private watchSystemScheme(): void {
    const query = this.document.defaultView?.matchMedia(
      '(prefers-color-scheme: dark)',
    );
    query?.addEventListener('change', (event) =>
      this.systemDark.set(event.matches),
    );
  }
}

function readStoredMode(): ThemeMode {
  const stored = localStore.read(THEME_MODE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function prefersDark(): boolean {
  return (
    globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  );
}
