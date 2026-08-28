import { ComponentType } from '@angular/cdk/overlay';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { Injectable, inject } from '@angular/core';

import { TelegramService } from '../telegram/telegram.service';

/**
 * Нижние шиты и диалоги поверх примитивов CDK.
 *
 * CDK отвечает за поведение - позиционирование, ловушку фокуса, блокировку
 * прокрутки фона, закрытие по Escape и клику по подложке. Оформление задаётся
 * классами приложения, поэтому не приходится перебивать чужие стили.
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly telegram = inject(TelegramService);

  /** Сколько наложений открыто: шит может открыть поверх себя другой шит. */
  private openCount = 0;
  private releaseBackButton: (() => void) | null = null;

  /** Лист, выезжающий снизу: основная форма на телефоне. */
  openSheet<TResult, TData>(
    component: ComponentType<unknown>,
    data?: TData,
  ): DialogRef<TResult> {
    this.telegram.impact('light');

    const ref = this.dialog.open<TResult>(component, {
      data,
      panelClass: 'sheet-panel',
      backdropClass: 'overlay-scrim',
      // Фон под листом не должен прокручиваться вместе с ним.
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy: this.overlay
        .position()
        .global()
        .bottom('0')
        .centerHorizontally(),
      maxWidth: '100vw',
      autoFocus: 'first-tabbable',
    });

    this.trackOverlay(ref);
    return ref;
  }

  /** Диалог по центру: только для необратимых действий. */
  openDialog<TResult, TData>(
    component: ComponentType<unknown>,
    data?: TData,
  ): DialogRef<TResult> {
    const ref = this.dialog.open<TResult>(component, {
      data,
      panelClass: 'dialog-panel',
      backdropClass: 'overlay-scrim',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      autoFocus: 'first-tabbable',
    });

    this.trackOverlay(ref);
    return ref;
  }

  /**
   * Пока открыто хотя бы одно наложение, показывает системную кнопку «Назад».
   *
   * Без этого в Mini App нажатие «Назад» при открытом листе сворачивает всё
   * приложение вместо того, чтобы закрыть лист.
   */
  private trackOverlay<TResult>(ref: DialogRef<TResult>): void {
    this.openCount += 1;

    if (this.openCount === 1) {
      this.releaseBackButton = this.telegram.showBackButton(() =>
        this.dialog.openDialogs.at(-1)?.close(),
      );
    }

    ref.closed.subscribe(() => {
      this.openCount -= 1;
      if (this.openCount === 0) {
        this.releaseBackButton?.();
        this.releaseBackButton = null;
      }
    });
  }
}
