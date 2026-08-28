import { DialogRef } from '@angular/cdk/dialog';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, merge } from 'rxjs';

/**
 * Переводит закрытие листа по Escape и клику мимо на обработчик компонента.
 *
 * Нужно там, где часть изменений уже ушла на сервер до нажатия «Сохранить»:
 * CDK по умолчанию закрывает лист вызовом `close()` без аргумента, страница
 * получает `undefined` и считает, что менять нечего. В результате связь,
 * созданная на сервере, в списке не появляется, а повторная попытка упирается
 * в ответ «категории уже связаны».
 */
export function closeOnDismiss<TResult>(
  ref: DialogRef<TResult>,
  close: () => void,
): void {
  const destroyRef = inject(DestroyRef);

  ref.disableClose = true;

  merge(
    ref.backdropClick,
    ref.keydownEvents.pipe(filter((event) => event.key === 'Escape')),
  )
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => close());
}
