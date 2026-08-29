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

  register(element: HTMLElement): void {
    this.element = element;
  }

  get offset(): number {
    return this.element?.scrollTop ?? 0;
  }

  restore(offset: number): void {
    this.element?.scrollTo({ top: offset });
  }
}
