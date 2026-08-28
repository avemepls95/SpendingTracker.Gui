import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { TokenStorageService } from '../auth/token-storage.service';
import { ToastService } from '../ui/toast.service';
import { TokenRefreshService } from './token-refresh.service';

/** Запросы самой авторизации не должны нести токен и не подлежат продлению. */
function isAuthEndpoint(request: HttpRequest<unknown>): boolean {
  return request.url.includes('/auth/');
}

function withToken<T>(request: HttpRequest<T>, token: string): HttpRequest<T> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Подставляет токен доступа и продлевает сессию при ответе 401.
 *
 * Ошибки пробрасываются подписчику, а не гасятся: на их обработчике держатся
 * признаки занятости экранов, и проглоченная ошибка оставляет экран навсегда
 * в состоянии загрузки.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (isAuthEndpoint(request)) {
    return next(request);
  }

  const storage = inject(TokenStorageService);
  const refresher = inject(TokenRefreshService);
  const auth = inject(AuthService);
  const toast = inject(ToastService);

  const endSession = (error: unknown) => {
    toast.info('Время сессии истекло. Войдите заново');
    auth.signOut();
    return throwError(() => error);
  };

  const token = storage.accessToken;
  if (!token) {
    return endSession(new Error('Нет токена доступа'));
  }

  return next(withToken(request, token)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (!storage.canRefresh) {
        return endSession(error);
      }

      return refresher.refresh().pipe(
        switchMap((freshToken) => next(withToken(request, freshToken))),
        catchError((refreshError: unknown) => endSession(refreshError)),
      );
    }),
  );
};
