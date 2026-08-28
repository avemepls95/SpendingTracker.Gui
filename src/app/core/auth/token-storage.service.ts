import { Injectable, signal } from '@angular/core';

import { localStore } from '../storage/local-storage';
import { TokenInformation } from './auth.contracts';
import { isTokenExpired } from './jwt.util';

const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_ID_KEY = 'userLocalId';
const USER_NAME_KEY = 'userFirstName';
const USER_PHOTO_KEY = 'userPhotoUrl';

export interface StoredProfile {
  readonly firstName: string | null;
  readonly photoUrl: string | null;
}

/** Единственное место, где приложение знает о ключах хранилища. */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly profileSignal = signal<StoredProfile>(readProfile());

  readonly profile = this.profileSignal.asReadonly();

  get accessToken(): string | null {
    return localStore.read(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return localStore.read(REFRESH_TOKEN_KEY);
  }

  /** Есть непросроченный токен доступа. */
  get hasValidAccessToken(): boolean {
    const token = this.accessToken;
    return token !== null && !isTokenExpired(token);
  }

  /** Токен просрочен, но остался refresh - сессию ещё можно продлить. */
  get canRefresh(): boolean {
    return this.refreshToken !== null;
  }

  saveTokens(tokens: TokenInformation): void {
    localStore.write(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStore.write(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  saveProfile(profile: { firstName?: string; photoUrl?: string; id?: string }): void {
    if (profile.id) {
      localStore.write(USER_ID_KEY, profile.id);
    }
    if (profile.firstName) {
      localStore.write(USER_NAME_KEY, profile.firstName);
    }
    if (profile.photoUrl) {
      localStore.write(USER_PHOTO_KEY, profile.photoUrl);
    }

    this.profileSignal.set(readProfile());
  }

  clear(): void {
    for (const key of [
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      USER_ID_KEY,
      USER_NAME_KEY,
      USER_PHOTO_KEY,
    ]) {
      localStore.remove(key);
    }

    this.profileSignal.set(readProfile());
  }
}

function readProfile(): StoredProfile {
  return {
    firstName: localStore.read(USER_NAME_KEY),
    photoUrl: localStore.read(USER_PHOTO_KEY),
  };
}
