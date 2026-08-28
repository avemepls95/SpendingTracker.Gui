import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  OnDestroy,
  inject,
  output,
  viewChild,
} from '@angular/core';

import { environment } from '../../../environments/environment';
import { TelegramWidgetAuthData } from '../../core/auth/auth.contracts';

/** Имя глобального колбэка, который дёргает виджет Telegram. */
const CALLBACK_NAME = 'onTelegramWidgetAuth';

type WidgetGlobals = Record<string, ((data: TelegramWidgetAuthData) => void) | undefined>;

/**
 * Кнопка входа через Telegram для обычного браузера.
 *
 * Виджет умеет вызывать только глобальную функцию по имени, поэтому колбэк
 * приходится вешать на window. Он снимается в ngOnDestroy, чтобы не оставлять
 * ссылку на уничтоженный компонент.
 */
@Component({
  selector: 'app-telegram-login-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #mount class="widget-mount"></div>`,
  styles: `
    .widget-mount {
      display: flex;
      justify-content: center;
      min-height: 48px;
    }
  `,
})
export class TelegramLoginWidgetComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly mount = viewChild.required<ElementRef<HTMLElement>>('mount');

  readonly authorized = output<TelegramWidgetAuthData>();
  readonly failed = output<void>();

  ngAfterViewInit(): void {
    const globals = this.document.defaultView as unknown as WidgetGlobals | null;
    if (!globals) {
      return;
    }

    globals[CALLBACK_NAME] = (data) => this.authorized.emit(data);

    const script = this.document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', environment.telegramBotName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', `${CALLBACK_NAME}(user)`);
    script.setAttribute('data-request-access', 'write');
    script.addEventListener('error', () => this.failed.emit());

    this.mount().nativeElement.appendChild(script);
  }

  ngOnDestroy(): void {
    const globals = this.document.defaultView as unknown as WidgetGlobals | null;
    if (globals) {
      delete globals[CALLBACK_NAME];
    }
  }
}
