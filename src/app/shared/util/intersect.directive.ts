import {
  Directive,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';

/**
 * Сообщает, что элемент показался на экране.
 *
 * Ставится на метку в конце списка и заменяет пакет ngx-infinite-scroll.
 * Прежний экран трат совмещал бесконечную прокрутку с кнопкой «More», причём
 * кнопка показывалась только пока в списке ровно одна страница записей и
 * после первой догрузки исчезала навсегда.
 */
@Directive({
  selector: '[appIntersect]',
})
export class IntersectDirective implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Запас снизу: догрузка начинается до того, как метка окажется в кадре. */
  readonly rootMargin = input('400px');
  readonly intersected = output<void>();

  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => this.observe());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private observe(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.intersected.emit();
        }
      },
      { rootMargin: this.rootMargin() },
    );

    this.observer.observe(this.host.nativeElement);
  }
}
