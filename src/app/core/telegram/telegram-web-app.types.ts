/**
 * Типы моста Telegram Mini App.
 *
 * Объявлены как необязательные: скрипт telegram-web-app.js подключается с
 * внешнего домена и может не загрузиться, а часть методов появилась в поздних
 * версиях Bot API и отсутствует в старых клиентах.
 */

export interface TelegramUser {
  readonly id: number;
  readonly first_name: string;
  readonly last_name?: string;
  readonly username?: string;
  readonly photo_url?: string;
  readonly language_code?: string;
}

export interface TelegramInitDataUnsafe {
  readonly user?: TelegramUser;
  readonly auth_date?: number;
  readonly hash?: string;
}

/** Цвета оформления клиента. Приходят в формате #rrggbb. */
export interface TelegramThemeParams {
  readonly bg_color?: string;
  readonly secondary_bg_color?: string;
  readonly section_bg_color?: string;
  readonly text_color?: string;
  readonly hint_color?: string;
  readonly subtitle_text_color?: string;
  readonly link_color?: string;
  readonly button_color?: string;
  readonly button_text_color?: string;
  readonly accent_text_color?: string;
  readonly destructive_text_color?: string;
  readonly header_bg_color?: string;
  readonly bottom_bar_bg_color?: string;
}

export interface TelegramInset {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface TelegramMainButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  setParams(params: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
  }): void;
  onClick(handler: () => void): void;
  offClick(handler: () => void): void;
  show(): void;
  hide(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
}

export interface TelegramBackButton {
  isVisible: boolean;
  onClick(handler: () => void): void;
  offClick(handler: () => void): void;
  show(): void;
  hide(): void;
}

export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type HapticNotificationType = 'error' | 'success' | 'warning';

export interface TelegramHapticFeedback {
  impactOccurred(style: HapticImpactStyle): void;
  notificationOccurred(type: HapticNotificationType): void;
  selectionChanged(): void;
}

export type TelegramEventName =
  | 'themeChanged'
  | 'viewportChanged'
  | 'safeAreaChanged'
  | 'contentSafeAreaChanged';

export interface TelegramWebApp {
  readonly initData: string;
  readonly initDataUnsafe: TelegramInitDataUnsafe;
  readonly version: string;
  readonly platform: string;
  readonly colorScheme: 'light' | 'dark';
  readonly themeParams: TelegramThemeParams;
  readonly isExpanded: boolean;
  readonly viewportStableHeight: number;
  readonly safeAreaInset?: TelegramInset;
  readonly contentSafeAreaInset?: TelegramInset;
  readonly MainButton: TelegramMainButton;
  readonly BackButton: TelegramBackButton;
  readonly HapticFeedback: TelegramHapticFeedback;

  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  disableVerticalSwipes?(): void;
  onEvent(event: TelegramEventName, handler: () => void): void;
  offEvent(event: TelegramEventName, handler: () => void): void;
}

interface TelegramNamespace {
  readonly WebApp?: TelegramWebApp;
}

/**
 * Возвращает мост Telegram или null вне Mini App.
 *
 * Прежний код обращался к `window.Telegram.WebApp` напрямую, поэтому при
 * незагруженном скрипте экран авторизации падал с TypeError и оставался пустым.
 */
export function readTelegramWebApp(): TelegramWebApp | null {
  const namespace = (globalThis as { Telegram?: TelegramNamespace }).Telegram;
  return namespace?.WebApp ?? null;
}
