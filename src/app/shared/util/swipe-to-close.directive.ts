import { Directive, ElementRef, inject, output } from '@angular/core';

/** Насколько нужно утянуть лист вниз, чтобы он закрылся. */
const DISMISS_DISTANCE_PX = 96;

/**
 * Закрывает лист смахиванием вниз.
 *
 * Полоска-ухватка в шапке обещает это движение, поэтому оно должно работать:
 * иначе пользователь тянет лист, ничего не происходит, и полоска оказывается
 * ложной подсказкой.
 *
 * Перетаскивание начинается только с шапки. Тело листа прокручивается, и жест
 * оттуда конфликтовал бы с прокруткой списка.
 */
@Directive({
  selector: '[appSwipeToClose]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd($event)',
    '(pointercancel)': 'onPointerEnd($event)',
  },
})
export class SwipeToCloseDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly dismissed = output<void>();

  private startY = 0;
  private offset = 0;
  private dragging = false;

  protected onPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;

    // Кнопки шапки - закрыть, удалить - должны работать как кнопки.
    if (target.closest('button')) {
      return;
    }

    if (!target.closest('.sheet__header, .sheet__grabber')) {
      return;
    }

    this.dragging = true;
    this.startY = event.clientY;
    this.offset = 0;
    this.element.style.transition = 'none';
    this.element.setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }

    // Тянуть вверх лист не даёт: он и так прижат к низу экрана.
    this.offset = Math.max(0, event.clientY - this.startY);
    this.element.style.transform = `translateY(${this.offset}px)`;
  }

  protected onPointerEnd(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }

    this.dragging = false;
    this.element.releasePointerCapture(event.pointerId);
    this.element.style.transition = '';
    this.element.style.transform = '';

    if (this.offset >= DISMISS_DISTANCE_PX) {
      this.dismissed.emit();
    }
  }

  private get element(): HTMLElement {
    return this.host.nativeElement;
  }
}
