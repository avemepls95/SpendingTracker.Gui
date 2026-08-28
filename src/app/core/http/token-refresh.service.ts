import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay, tap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { TokenStorageService } from '../auth/token-storage.service';

/**
 * Продление сессии с защитой от параллельных обращений.
 *
 * Когда токен протухает, в 401 обычно упирается сразу несколько запросов.
 * Без общей очереди каждый из них дёрнул бы refresh, и сервер отозвал бы
 * токен, выданный соседнему запросу.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(TokenStorageService);

  private inFlight: Observable<string> | null = null;

  /** Отдаёт новый токен доступа, переиспользуя уже идущее продление. */
  refresh(): Observable<string> {
    const existing = this.inFlight;
    if (existing) {
      return existing;
    }

    const refreshToken = this.storage.refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('Нет refresh-токена'));
    }

    const request = this.auth.refreshSession(refreshToken).pipe(
      map((tokens) => tokens.accessToken),
      tap({ complete: () => (this.inFlight = null) }),
      catchError((error: unknown) => {
        this.inFlight = null;
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.inFlight = request;
    return request;
  }
}
