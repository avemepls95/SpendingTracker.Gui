import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AuthByTelegramResponse,
  TelegramAuthRequest,
  TokenInformation,
} from './auth.contracts';
import { CurrentUserStore } from './current-user.store';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly storage = inject(TokenStorageService);
  private readonly currentUser = inject(CurrentUserStore);

  private readonly baseUrl = environment.spendingApi;

  /** Сессия активна либо может быть продлена по refresh-токену. */
  get isAuthenticated(): boolean {
    return this.storage.hasValidAccessToken || this.storage.canRefresh;
  }

  authenticateByTelegram(
    request: TelegramAuthRequest,
  ): Observable<AuthByTelegramResponse> {
    return this.http
      .post<AuthByTelegramResponse>(
        `${this.baseUrl}v1/auth/token/generate/telegram`,
        request,
      )
      .pipe(
        tap((response) => {
          this.storage.saveTokens(response.tokenInformation);
          this.storage.saveProfile({
            id: response.id,
            firstName: response.firstName,
          });
        }),
      );
  }

  /**
   * Продлевает сессию.
   *
   * Метод существовал и раньше, но не вызывался ниоткуда, поэтому сессия
   * просто истекала. Теперь его дёргает интерцептор при ответе 401.
   */
  refreshSession(refreshToken: string): Observable<TokenInformation> {
    return this.http
      .post<TokenInformation>(`${this.baseUrl}v1/auth/token/refresh`, {
        refreshToken,
      })
      .pipe(tap((tokens) => this.storage.saveTokens(tokens)));
  }

  signOut(): void {
    this.storage.clear();
    this.currentUser.reset();
    void this.router.navigate(['/auth']);
  }
}
