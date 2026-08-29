import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

import {
  HapticImpactStyle,
  HapticNotificationType,
  TelegramInset,
  TelegramUser,
  TelegramWebApp,
  readTelegramWebApp,
} from './telegram-web-app.types';

/** Пустые отступы: используются вне Mini App и на клиентах без поддержки safeAreaInset. */
const NO_INSET: TelegramInset = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Единственная точка обращения к Telegram Mini App.
 *
 * Наружу отдаёт сигналы, чтобы интерфейс перерисовывался на смену темы и
 * безопасных зон. Все вызовы моста защищены проверками: приложение обязано
 * работать и в обычном браузере, где моста нет.
 */
@Injectable({ providedIn: 'root' })
export class TelegramService {
  private readonly document = inject(DOCUMENT);
  private readonly webApp: TelegramWebApp | null = readTelegramWebApp();

  private readonly safeAreaSignal = signal<TelegramInset>(
    this.webApp?.safeAreaInset ?? NO_INSET,
  );
  private readonly contentSafeAreaSignal = signal<TelegramInset>(
    this.webApp?.contentSafeAreaInset ?? NO_INSET,
  );

  /**
   * Приложение открыто внутри клиента Telegram, а не в обычном браузере.
   *
   * Проверять одно лишь наличие моста нельзя: telegram-web-app.js подключён
   * в index.html и создаёт window.Telegram.WebApp в любом браузере. Вне
   * клиента мост отдаёт platform === 'unknown'.
   */
  readonly isMiniApp =
    this.webApp !== null && this.webApp.platform !== 'unknown';

  /**
   * Пользователь запущен из Mini App с готовыми данными авторизации.
   *
   * Определяется по текущему `initDataUnsafe`, а не по записи в localStorage:
   * прежняя реализация сохраняла флаг навсегда, и после одного входа через
   * Telegram обычный браузер до конца жизни хранилища считался Mini App.
   */
  readonly isLaunchedFromTelegram = Boolean(this.webApp?.initDataUnsafe.user);

  readonly safeArea = this.safeAreaSignal.asReadonly();
  readonly contentSafeArea = this.contentSafeAreaSignal.asReadonly();

  /** Суммарный верхний отступ: вырез экрана плюс шапка клиента. */
  readonly topInset = computed(
    () => this.safeArea().top + this.contentSafeArea().top,
  );

  readonly bottomInset = computed(
    () => this.safeArea().bottom + this.contentSafeArea().bottom,
  );

  constructor() {
    // Отступы приходят от клиента и меняются при повороте экрана и
    // разворачивании окна, поэтому переменные пересчитываются реактивно.
    effect(() => this.applyInsetVariables(this.topInset(), this.bottomInset()));
  }

  get user(): TelegramUser | null {
    return this.webApp?.initDataUnsafe.user ?? null;
  }

  /** Строка initData для проверки подписи на сервере. */
  get initData(): string {
    return this.webApp?.initData ?? '';
  }

  /**
   * Сообщает клиенту, что интерфейс готов, и разворачивает окно на всю высоту.
   * Без expand() Mini App открывается наполовину экрана.
   */
  initialize(): void {
    this.trackViewport();

    const webApp = this.webApp;
    if (!webApp) {
      return;
    }

    webApp.ready();
    webApp.expand();

    // Без этого вертикальное смахивание по списку трат закрывает Mini App.
    if (this.supports('7.7')) {
      webApp.disableVerticalSwipes?.();
    }

    const syncInsets = (): void => {
      this.safeAreaSignal.set(webApp.safeAreaInset ?? NO_INSET);
      this.contentSafeAreaSignal.set(webApp.contentSafeAreaInset ?? NO_INSET);
    };

    webApp.onEvent('safeAreaChanged', syncInsets);
    webApp.onEvent('contentSafeAreaChanged', syncInsets);

    syncInsets();
  }

  /** Красит шапку и фон клиента в цвет приложения, чтобы не было чужой полосы сверху. */
  applyChromeColor(background: string): void {
    if (!this.webApp || !this.supports('6.1')) {
      return;
    }

    this.webApp.setHeaderColor(background);
    this.webApp.setBackgroundColor(background);
    if (this.supports('7.10')) {
      this.webApp.setBottomBarColor?.(background);
    }
  }

  /** Тактильный отклик на подтверждении действия. */
  impact(style: HapticImpactStyle = 'light'): void {
    if (this.supports('6.1')) {
      this.webApp?.HapticFeedback.impactOccurred(style);
    }
  }

  notify(type: HapticNotificationType): void {
    if (this.supports('6.1')) {
      this.webApp?.HapticFeedback.notificationOccurred(type);
    }
  }

  selectionChanged(): void {
    if (this.supports('6.1')) {
      this.webApp?.HapticFeedback.selectionChanged();
    }
  }

  /**
   * Показывает системную кнопку «Назад» и вызывает обработчик по нажатию.
   * Возвращает функцию снятия подписки.
   */
  showBackButton(handler: () => void): () => void {
    const backButton = this.webApp?.BackButton;
    if (!backButton || !this.supports('6.1')) {
      return () => undefined;
    }

    backButton.onClick(handler);
    backButton.show();

    return () => {
      backButton.offClick(handler);
      backButton.hide();
    };
  }

  /**
   * Держит в CSS-переменных две высоты окна.
   *
   * Стабильную сообщает клиент: в iOS страница разворачивается выше экрана,
   * и 100dvh отдаёт больше, чем видно на самом деле. Про клавиатуру клиент
   * не знает - её замечает только браузер, поэтому наложения считаются по
   * меньшей из двух высот: иначе нижний лист уходит под клавиатуру.
   */
  private trackViewport(): void {
    const style = this.document.documentElement.style;
    const view = this.document.defaultView;
    const visualViewport = view?.visualViewport ?? null;

    const apply = (): void => {
      // Вне клиента стабильной высоты нет: там мост отдаёт размер окна один
      // раз и об изменениях не сообщает. Видимую высоту ниже это не трогает -
      // её отдаёт браузер, и она нужна в любом окружении.
      const stableHeight = this.isMiniApp ? this.webApp?.viewportStableHeight ?? 0 : 0;
      if (stableHeight > 0) {
        style.setProperty('--app-viewport-height', `${stableHeight}px`);
      }

      const heights = [stableHeight, visualViewport?.height ?? 0].filter(
        (height) => height > 0,
      );
      if (heights.length > 0) {
        style.setProperty('--app-visible-height', `${Math.min(...heights)}px`);
      }
    };

    if (this.isMiniApp) {
      this.webApp?.onEvent('viewportChanged', apply);
    }

    // Клавиатуру замечает visualViewport, поворот экрана и смену размера
    // окна - обычный resize: по отдельности каждый из них покрывает не всё.
    visualViewport?.addEventListener('resize', apply);
    view?.addEventListener('resize', apply);
    apply();
  }

  /**
   * Переносит отступы Telegram в CSS-переменные.
   *
   * Внутри Mini App env(safe-area-inset-*) занижен: клиент рисует поверх
   * страницы собственную шапку, о которой браузер не знает.
   */
  private applyInsetVariables(top: number, bottom: number): void {
    const style = this.document.documentElement.style;
    style.setProperty('--tg-safe-area-inset-top', `${top}px`);
    style.setProperty('--tg-safe-area-inset-bottom', `${bottom}px`);
  }

  private supports(version: string): boolean {
    try {
      return this.webApp?.isVersionAtLeast(version) ?? false;
    } catch {
      return false;
    }
  }
}
