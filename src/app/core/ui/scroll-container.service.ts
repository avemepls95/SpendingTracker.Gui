import { Injectable } from '@angular/core';

/**
 * Ссылка на прокручиваемую область каркаса.
 *
 * Документ в приложении не прокручивается: высота .shell равна экрану, а
 * прокрутка живёт внутри .shell__content. Поэтому экранам, которым нужно
 * запомнить и вернуть место в списке, не подходит ни window.scrollY, ни
 * ViewportScroller - оба смотрят на документ.
 */
@Injectable({ providedIn: 'root' })
export class ScrollContainerService {
  private element: HTMLElement | null = null;

  /** Место в списке на момент блокировки; null - блокировки нет. */
  private lockedOffset: number | null = null;

  /** null снимает регистрацию: ссылка на элемент уничтоженного каркаса не нужна. */
  register(element: HTMLElement | null): void {
    this.element = element;
  }

  get offset(): number {
    return this.element?.scrollTop ?? 0;
  }

  restore(offset: number): void {
    this.element?.scrollTo({ top: offset });
  }

  /**
   * Останавливает прокрутку каркаса, пока поверх него открыто наложение.
   *
   * Стратегия CDK умеет блокировать только документ, а он здесь и так не
   * прокручивается. Без этой блокировки жест по листу, которому прокручивать
   * нечего, браузер отдаёт ближайшему прокручиваемому предку - и под
   * неподвижным листом едет список.
   *
   * Место в списке запоминается: у элемента, потерявшего прокрутку, WebKit
   * вправе сбросить scrollTop, и после закрытия листа страница прыгнула бы
   * наверх.
   */
  lock(): void {
    const element = this.element;
    if (!element || this.lockedOffset !== null) {
      return;
    }

    this.lockedOffset = element.scrollTop;
    element.classList.add('shell__content--locked');
  }

  unlock(): void {
    const element = this.element;
    const offset = this.lockedOffset;
    this.lockedOffset = null;

    if (!element || offset === null) {
      return;
    }

    element.classList.remove('shell__content--locked');
    element.scrollTop = offset;
  }
}
