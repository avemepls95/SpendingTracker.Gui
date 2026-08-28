import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  TelegramAuthRequest,
  TelegramWidgetAuthData,
  buildWidgetCheckString,
} from '../../core/auth/auth.contracts';
import { AuthService } from '../../core/auth/auth.service';
import { TokenStorageService } from '../../core/auth/token-storage.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { TelegramLoginWidgetComponent } from './telegram-login-widget.component';

type AuthState = 'idle' | 'pending' | 'failed';

@Component({
  selector: 'app-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TelegramLoginWidgetComponent, IconComponent],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss',
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(TokenStorageService);
  private readonly telegram = inject(TelegramService);
  private readonly router = inject(Router);

  protected readonly state = signal<AuthState>('idle');

  /** В Mini App вход происходит сам: подтверждать личность второй раз незачем. */
  protected readonly isMiniApp = this.telegram.isMiniApp;

  constructor() {
    if (this.auth.isAuthenticated) {
      void this.router.navigate(['/']);
      return;
    }

    if (this.telegram.isLaunchedFromTelegram) {
      this.signInFromMiniApp();
    }
  }

  protected onWidgetAuth(data: TelegramWidgetAuthData): void {
    this.storage.saveProfile({
      firstName: data.first_name,
      photoUrl: data.photo_url,
    });

    this.signIn({
      firstName: data.first_name,
      lastName: data.last_name,
      userId: data.id,
      username: data.username,
      checkString: buildWidgetCheckString(data),
      authType: 'widget',
    });
  }

  protected retry(): void {
    if (this.telegram.isLaunchedFromTelegram) {
      this.signInFromMiniApp();
    } else {
      this.state.set('idle');
    }
  }

  private signInFromMiniApp(): void {
    const user = this.telegram.user;
    if (!user) {
      this.state.set('failed');
      return;
    }

    this.storage.saveProfile({
      firstName: user.first_name,
      photoUrl: user.photo_url,
    });

    this.signIn({
      firstName: user.first_name,
      lastName: user.last_name ?? '',
      userId: user.id,
      username: user.username ?? '',
      checkString: this.telegram.initData,
      authType: 'webApp',
    });
  }

  private signIn(request: TelegramAuthRequest): void {
    this.state.set('pending');

    this.auth.authenticateByTelegram(request).subscribe({
      next: () => {
        this.telegram.notify('success');
        void this.router.navigate(['/']);
      },
      error: () => this.state.set('failed'),
    });
  }
}
