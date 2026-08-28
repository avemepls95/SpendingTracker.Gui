import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ToastService } from '../ui/toast.service';
import { extractErrorMessages } from './api-error';

/**
 * Показывает ошибки сервера пользователю и пробрасывает их дальше.
 *
 * Ошибка обязана дойти до подписчика: на её обработчике держатся все признаки
 * занятости экранов. Если вернуть отсюда EMPTY, поток завершится без значения,
 * колбэк error не вызовется ни разу, и экран навсегда останется в состоянии
 * загрузки, а кнопки - заблокированными.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      for (const message of describe(error, request.url)) {
        toast.error(message);
      }

      return throwError(() => error);
    }),
  );
};

/**
 * Сообщения для пользователя.
 *
 * Пустой список означает «показывать нечего»: об истёкшей сессии сообщает
 * authInterceptor после неудачной попытки её продлить, а не этот перехватчик.
 */
function describe(error: HttpErrorResponse, url: string): readonly string[] {
  if (error.status === 401) {
    return [];
  }

  // Неудачу продления сессии показывает authInterceptor, иначе пользователь
  // увидит две плашки подряд об одном и том же.
  if (url.includes('/auth/token/refresh')) {
    return [];
  }

  switch (error.status) {
    case 0:
      return ['Нет связи с сервером. Проверьте интернет'];

    case 400:
      return extractErrorMessages(error.error);

    case 403:
      return ['Доступ запрещён'];

    case 404:
      return ['Данные не найдены'];

    default:
      return error.status >= 500
        ? ['Сервер не смог обработать запрос. Попробуйте позже']
        : ['Не удалось выполнить запрос'];
  }
}
