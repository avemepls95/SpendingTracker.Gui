import { ComponentType } from '@angular/cdk/overlay';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { Injectable, inject } from '@angular/core';

import { TelegramService } from '../telegram/telegram.service';

export interface SheetOptions {
  /**
   * Имя наложения для скринридера.
   *
   * Задаётся здесь, а не разметкой листа: роль dialog несёт контейнер CDK,
   * и подпись должна лежать на нём же. Собственный role="dialog" внутри
   * содержимого создавал бы вложенный диалог, а внешний оставался безымянным.
   */
  readonly ariaLabel: string;
}

/**
 * Нижние шиты и диалоги поверх примитивов CDK.
 *
 * CDK отвечает за поведение - позиционирование, ловушку фокуса, закрытие по
 * Escape и клику по подложке. Оформление задаётся классами приложения,
 * поэтому не приходится перебивать чужие стили.
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly telegram = inject(TelegramService);

  /** Сколько наложений открыто: шит может открыть поверх себя другой шит. */
  private openCount = 0;
  private releaseBackButton: (() => void) | null = null;

  /**
   * Собственные обработчики закрытия листов.
   *
   * Часть листов применяет изменения до нажатия «Сохранить» и обязана вернуть
   * их странице при любом способе закрытия. Прямой DialogRef.close() отдал бы
   * undefined: disableClose останавливает Escape и клик мимо, но не
   * программный вызов.
   */
  private readonly dismissHandlers = new WeakMap<object, () => void>();

  /** Перенаправляет закрытие листа системной кнопкой на обработчик компонента. */
  registerDismiss(ref: DialogRef<unknown>, dismiss: () => void): void {
    this.dismissHandlers.set(ref, dismiss);
  }

  /** Лист, выезжающий снизу: основная форма на телефоне. */
  openSheet<TResult, TData>(
    component: ComponentType<unknown>,
    data: TData,
    options: SheetOptions,
  ): DialogRef<TResult> {
    this.telegram.impact('light');

    const ref = this.dialog.open<TResult>(component, {
      data,
      panelClass: 'sheet-panel',
      backdropClass: 'overlay-scrim',
      ariaLabel: options.ariaLabel,
      // Фокус ставится на сам контейнер, а не на первый интерактивный элемент:
      // в шапке листа первой стоит кнопка удаления, и она принимала бы Enter
      // сразу после открытия.
      autoFocus: 'dialog',
      // Страховка на случай, если содержимое когда-нибудь начнёт
      // прокручивать документ: сейчас прокрутка живёт внутри .shell__content,
      // высота которого равна экрану, и блокировать документу нечего.
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy: this.overlay
        .position()
        .global()
        .bottom('0')
        .centerHorizontally(),
      maxWidth: '100vw',
    });

    this.trackOverlay(ref);
    return ref;
  }

  /** Диалог по центру: только для необратимых действий. */
  openDialog<TResult, TData>(
    component: ComponentType<unknown>,
    data: TData,
    options: SheetOptions,
  ): DialogRef<TResult> {
    const ref = this.dialog.open<TResult>(component, {
      data,
      panelClass: 'dialog-panel',
      backdropClass: 'overlay-scrim',
      ariaLabel: options.ariaLabel,
      // Прерывает работу и требует ответа - роль alertdialog, а не dialog.
      role: 'alertdialog',
      autoFocus: 'dialog',
      scrollStrategy: this.overlay.scrollStrategies.block(),
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
      this.releaseBackButton = this.telegram.showBackButton(() => {
        const top = this.dialog.openDialogs.at(-1);
        if (!top) {
          return;
        }

        const dismiss = this.dismissHandlers.get(top);
        if (dismiss) {
          dismiss();
          return;
        }

        top.close();
      });
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
