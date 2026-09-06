import { DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';

/** Насколько нужно утянуть лист вниз, чтобы он закрылся. */
const DISMISS_DISTANCE_PX = 96;

/**
 * С какого смещения становится понятно, что это за жест.
 *
 * Порог меньше собственного порога браузера (у Chrome - 8 пикселей): решение
 * должно быть принято раньше, чем браузер решит, что началась прокрутка.
 */
const DIRECTION_THRESHOLD_PX = 4;

/** Элементы, у которых своё поведение при касании: они не должны тянуть лист. */
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, label, [contenteditable]';

/** Зона, с которой лист тянется сразу, без разбора направления. */
const HANDLE_SELECTOR = '.sheet__header, .sheet__grabber';

/**
 * Состояние жеста в пределах одного касания.
 *
 * `pending` - палец опущен там, где жест может оказаться и прокруткой,
 * и перетаскиванием, а направление ещё не проявилось. `declined` - касание
 * ушло прокрутке и до конца жеста листу уже не вернётся.
 */
type GestureState = 'idle' | 'pending' | 'dragging' | 'declined';

/**
 * Закрывает лист смахиванием вниз.
 *
 * Полоска-ухватка в шапке обещает это движение, поэтому оно должно работать:
 * иначе пользователь тянет лист, ничего не происходит, и полоска оказывается
 * ложной подсказкой.
 *
 * Тянуть можно и за тело листа - так устроены системные шторки. Жест и
 * прокрутка списка делят одно касание, поэтому владелец выбирается один раз,
 * в начале, и до конца касания не меняется:
 *
 * - список под пальцем прокручен не с самого верха - касание целиком его,
 *   лист не трогаем;
 * - список в самом верху или прокручивать нечего - ждём первого движения:
 *   вниз тянет лист, вверх или вбок отдаёт касание прокрутке;
 * - шапка и ухватка тянут лист сразу: браузеру вертикальный жест оттуда
 *   не достаётся вовсе (touch-action в _overlay.scss).
 *
 * Пока лист тянут, touchmove отменяется - иначе браузер уводит то же касание
 * в прокрутку и обрывает наши pointermove событием pointercancel.
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

  private state: GestureState = 'idle';
  private startX = 0;
  private startY = 0;
  private offset = 0;
  private pointerId: number | null = null;

  constructor() {
    const element = this.element;
    const onTouchMove = (event: TouchEvent): void => this.onTouchMove(event);

    // Слушатель ставится вручную ради { passive: false }: остановить прокрутку
    // можно только через preventDefault, а пассивному обработчику это запрещено.
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    inject(DestroyRef).onDestroy(() => element.removeEventListener('touchmove', onTouchMove));
  }

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

    // Список, прокрученный не с самого верха, забирает касание целиком:
    // подхватывать лист посреди прокрутки нельзя - он дёргался бы от каждого
    // движения пальца, которым пользователь листает содержимое.
    const scroller = this.scrollableAncestor(target);
    if (scroller && scroller.scrollTop > 0) {
      return;
    }

    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.offset = 0;
    this.element.classList.remove('sheet--returning');

    if (target.closest(HANDLE_SELECTOR)) {
      this.startDrag();
      return;
    }

    this.state = 'pending';
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    if (this.state === 'pending') {
      this.decide(event.clientX, event.clientY);
    }

    if (this.state === 'dragging') {
      // Тянуть вверх лист не даёт: он и так прижат к низу экрана.
      this.offset = Math.max(0, event.clientY - this.startY);
      this.element.style.transform = `translateY(${this.offset}px)`;
    }
  }

  /**
   * Не даёт браузеру увести то же касание в прокрутку.
   *
   * Решение уже принято в pointermove: для касания он приходит раньше
   * touchmove, поэтому здесь остаётся только отменить умолчание. Отменять
   * его до решения нельзя - браузер отключает прокрутку на весь жест,
   * и список перестал бы листаться вверх.
   */
  protected onTouchMove(event: TouchEvent): void {
    if (this.state === 'dragging' && event.cancelable) {
      event.preventDefault();
    }
  }

  protected onPointerEnd(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    const offset = this.offset;
    this.pointerId = null;
    this.offset = 0;
    this.state = 'idle';

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

  /** Направление первого заметного движения решает, чей это жест. */
  private decide(clientX: number, clientY: number): void {
    const dx = clientX - this.startX;
    const dy = clientY - this.startY;

    if (dy >= DIRECTION_THRESHOLD_PX && dy > Math.abs(dx)) {
      this.startDrag();
      return;
    }

    if (-dy >= DIRECTION_THRESHOLD_PX || Math.abs(dx) >= DIRECTION_THRESHOLD_PX) {
      this.state = 'declined';
    }
  }

  private startDrag(): void {
    this.state = 'dragging';

    if (this.pointerId !== null) {
      this.element.setPointerCapture(this.pointerId);
    }
  }

  /**
   * Ближайший прокручиваемый предок внутри листа.
   *
   * Нужен именно ближайший: в теле листа встречаются собственные
   * прокручиваемые блоки - например, широкие примеры разметки, - и решать
   * должен тот из них, под которым палец. Блоки, которым прокручивать нечего,
   * пропускаются: браузер их тоже не считает и отдаёт жест дальше по цепочке.
   */
  private scrollableAncestor(target: HTMLElement): HTMLElement | null {
    let node: HTMLElement | null = target;

    while (node && node !== this.element) {
      // Допуск в пиксель: высоты бывают дробными, и разница в доли пикселя
      // ещё не означает прокрутку.
      if (node.scrollHeight - node.clientHeight > 1) {
        const { overflowY } = getComputedStyle(node);
        if (overflowY === 'auto' || overflowY === 'scroll') {
          return node;
        }
      }

      node = node.parentElement;
    }

    return null;
  }

  private get element(): HTMLElement {
    return this.host.nativeElement;
  }
}
