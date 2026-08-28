import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Прячет изображение, которое не загрузилось.
 *
 * Флаги валют приходят с внешнего CDN: при недоступности или блокировке
 * браузер рисует значок битой картинки. Рядом всегда стоит код валюты,
 * поэтому пропавший флаг ничего не ломает, а сломанный значок выглядит
 * как ошибка приложения.
 */
@Directive({
  selector: 'img[appHideOnError]',
  host: { '(error)': 'hide()' },
})
export class HideOnErrorDirective {
  private readonly host = inject<ElementRef<HTMLImageElement>>(ElementRef);

  protected hide(): void {
    this.host.nativeElement.style.visibility = 'hidden';
  }
}
