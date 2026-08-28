import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {TelegramAuthDto} from "../Contracts/TelegramAuthDto";
import {LocalStorageManager} from "../../../LocalStorageManager";
import { JwtHelperService } from '@auth0/angular-jwt';
import {TokenInformationDto} from "../Contracts/TokenInformationDto";
import {AuthByTelegramResponse} from "../Contracts/AuthByTelegramResponse";
import {Router} from "@angular/router";

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiBaseUrl: string;

  constructor(
    private http: HttpClient,
    private jwtHelper: JwtHelperService,
    private router: Router
  ) {
    this.apiBaseUrl = environment.spendingApi;
  }

  generateTokenByTelegramAuth(loginData: TelegramAuthDto): Observable<AuthByTelegramResponse> {
    return this.http.post<AuthByTelegramResponse>(this.apiBaseUrl + 'v1/auth/token/generate/telegram', loginData);
  }

  refreshAuthToken(refreshToken: string): Observable<TokenInformationDto> {
    return this.http.post<TokenInformationDto>(
      this.apiBaseUrl + 'v1/auth/token/refresh',
      { refreshToken });
  }

  saveTokenInformation(tokenInformation : TokenInformationDto) {
    localStorage.removeItem(LocalStorageManager.tokenKey)
    localStorage.setItem(LocalStorageManager.tokenKey, tokenInformation.accessToken)

    localStorage.removeItem(LocalStorageManager.tokenExpireDateKey)
    localStorage.setItem(LocalStorageManager.tokenExpireDateKey, tokenInformation.expiresIn.toString())

    localStorage.removeItem(LocalStorageManager.refreshTokenKey)
    localStorage.setItem(LocalStorageManager.refreshTokenKey, tokenInformation.refreshToken)
  }

  public removeCurrentToken() {
    localStorage.removeItem(LocalStorageManager.tokenKey);
  }

  public getTokenFromStorage(): string | null {
    return localStorage.getItem(LocalStorageManager.tokenKey);
  }

  public getTokenExpireDateFromStorage(): Date | null {
    let dateAsString = localStorage.getItem(LocalStorageManager.tokenExpireDateKey);
    if (!dateAsString) {
      return null;
    }

    return new Date(dateAsString);
  }

  public getRefreshTokenFromStorage(): string | null {
    return localStorage.getItem(LocalStorageManager.refreshTokenKey);
  }

  public isAuthenticated(): boolean {
    const token = this.getTokenFromStorage();
    if (token == null)
      return false;

    return !this.jwtHelper.isTokenExpired(token);
  }

  public signOut(): void {
    this.router.navigate(['/auth']);
  }
}
