import { Directive, ElementRef, inject, output } from '@angular/core';

/** Насколько нужно утянуть лист вниз, чтобы он закрылся. */
const DISMISS_DISTANCE_PX = 96;

/** Элементы, у которых своё поведение при касании: они не должны тянуть лист. */
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, label, [contenteditable]';

/** Что считается зоной перетаскивания. */
const HANDLE_SELECTOR = '.sheet__header, .sheet__grabber';

/**
 * Закрывает лист смахиванием вниз.
 *
 * Полоска-ухватка в шапке обещает это движение, поэтому оно должно работать:
 * иначе пользователь тянет лист, ничего не происходит, и полоска оказывается
 * ложной подсказкой.
 *
 * Перетаскивание начинается только с шапки. Тело листа прокручивается, и жест
 * оттуда конфликтовал бы с прокруткой списка.
 *
 * Зона перетаскивания обязана запрещать браузеру вертикальную прокрутку
 * (touch-action в _overlay.scss): иначе браузер забирает вертикальный жест
 * себе ещё до первого pointermove.
 */
@Directive({
  selector: '[appSwipeToClose]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd($event)',
    '(pointercancel)': 'onPointerEnd($event)',
    '(transitionend)': 'onTransitionEnd($event)',
  },
})
export class SwipeToCloseDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly dismissed = output<void>();

  private startY = 0;
  private offset = 0;
  private pointerId: number | null = null;

  protected onPointerDown(event: PointerEvent): void {
    // Второй палец во время жеста не должен перехватывать перетаскивание.
    if (this.pointerId !== null || !event.isPrimary) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    // Кнопки шапки - закрыть, удалить - должны работать как кнопки.
    if (target.closest(INTERACTIVE_SELECTOR)) {
      return;
    }

    if (!target.closest(HANDLE_SELECTOR)) {
      return;
    }

    this.pointerId = event.pointerId;
    this.startY = event.clientY;
    this.offset = 0;
    this.element.classList.remove('sheet--returning');
    this.element.setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    // Тянуть вверх лист не даёт: он и так прижат к низу экрана.
    this.offset = Math.max(0, event.clientY - this.startY);
    this.element.style.transform = `translateY(${this.offset}px)`;
  }

  protected onPointerEnd(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    const offset = this.offset;
    this.pointerId = null;
    this.offset = 0;

    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }

    // Лист возвращается на место в любом случае: обработчик закрытия может
    // отказать - например, пока идёт незавершённый запрос, - и тогда лист
    // остался бы висеть смещённым.
    //
    // Без смещения переход не запустится, а значит и transitionend не придёт -
    // класс остался бы на листе навсегда.
    if (offset > 0) {
      this.element.classList.add('sheet--returning');
    }

    this.element.style.transform = '';

    // pointercancel приходит и когда систему увела с жеста на полпути:
    // закрывать лист по такому обрыву нельзя, палец до конца не дошёл.
    if (offset >= DISMISS_DISTANCE_PX && event.type === 'pointerup') {
      this.dismissed.emit();
    }
  }

  /**
   * Возврат доехал - класс перехода больше не нужен.
   *
   * Иначе он висел бы на листе до следующего жеста, и по разметке нельзя было
   * бы отличить едущий лист от давно вернувшегося. Событие слушается на хосте,
   * а не разовой подпиской в конце жеста: прерванный переход transitionend не
   * шлёт, и разовые подписки копились бы на элементе.
   */
  protected onTransitionEnd(event: TransitionEvent): void {
    if (event.target === this.element && event.propertyName === 'transform') {
      this.element.classList.remove('sheet--returning');
    }
  }

  private get element(): HTMLElement {
    return this.host.nativeElement;
  }
}
