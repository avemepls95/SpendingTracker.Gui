import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { TokenStorageService } from '../auth/token-storage.service';
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
 * Раньше продление не вызывалось нигде, поэтому по истечении токена
 * пользователя просто выкидывало на экран входа.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (isAuthEndpoint(request)) {
    return next(request);
  }

  const storage = inject(TokenStorageService);
  const refresher = inject(TokenRefreshService);
  const auth = inject(AuthService);

  const token = storage.accessToken;
  if (!token) {
    auth.signOut();
    return EMPTY;
  }

  return next(withToken(request, token)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (!storage.canRefresh) {
        auth.signOut();
        return EMPTY;
      }

      return refresher.refresh().pipe(
        switchMap((freshToken) => next(withToken(request, freshToken))),
        catchError(() => {
          auth.signOut();
          return EMPTY;
        }),
      );
    }),
  );
};
