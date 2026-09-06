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

  /**
   * Открыто ли поверх каркаса наложение.
   *
   * Признак хранится отдельно от элемента: блокировка принадлежит наложениям,
   * а каркас за её время могут уничтожить и создать заново.
   */
  private locked = false;

  /** Место в списке на момент блокировки. */
  private lockedOffset = 0;

  /**
   * null снимает регистрацию: ссылка на элемент уничтоженного каркаса не нужна.
   *
   * Каркас может смениться прямо под открытым наложением: лист живёт в
   * контейнере наложений, а не в дереве роутера, и переживает уход на экран
   * входа по истёкшей сессии и возврат обратно. Поэтому блокировка
   * переносится на новый элемент, а запомненное место забывается - оно
   * относилось к уничтоженному элементу и вернуло бы чужую прокрутку.
   */
  register(element: HTMLElement | null): void {
    this.element = element;

    if (!element || !this.locked) {
      return;
    }

    this.lockedOffset = element.scrollTop;
    element.classList.add('shell__content--locked');
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
    if (this.locked) {
      return;
    }

    this.locked = true;
    this.lockedOffset = this.element?.scrollTop ?? 0;
    this.element?.classList.add('shell__content--locked');
  }

  unlock(): void {
    if (!this.locked) {
      return;
    }

    this.locked = false;

    const element = this.element;
    if (!element) {
      return;
    }

    element.classList.remove('shell__content--locked');
    element.scrollTop = this.lockedOffset;
  }
}
