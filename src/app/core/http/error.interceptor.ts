import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, catchError, throwError } from 'rxjs';

import { ToastService } from '../ui/toast.service';
import { extractErrorMessages } from './api-error';

/**
 * Показывает ошибки сервера пользователю.
 *
 * Ответ 401 сюда не доходит: его перехватывает authInterceptor,
 * который сначала пытается продлить сессию.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  // Продление сессии обрабатывает authInterceptor: он должен увидеть ошибку
  // сам и увести на экран входа, а не получить пустой поток.
  if (request.url.includes('/auth/token/refresh')) {
    return next(request);
  }

  const toast = inject(ToastService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      switch (error.status) {
        case 0:
          toast.error('Нет связи с сервером. Проверьте интернет');
          return EMPTY;

        case 400:
          for (const message of extractErrorMessages(error.error)) {
            toast.error(message);
          }
          return EMPTY;

        case 403:
          toast.error('Доступ запрещён');
          return EMPTY;

        case 404:
          toast.error('Данные не найдены');
          return EMPTY;

        default:
          if (error.status >= 500) {
            toast.error('Сервер не смог обработать запрос. Попробуйте позже');
            return EMPTY;
          }

          return throwError(() => error);
      }
    }),
  );
};
