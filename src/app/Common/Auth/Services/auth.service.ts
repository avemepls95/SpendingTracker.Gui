import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
// import { AppConfig } from '../app.config';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {TelegramToBalanceAuthDto} from "../Contracts/TelegramToBalanceAuthDto";
import {LocalStorageManager} from "../../../LocalStorageManager";

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiBaseUrl: string;

  constructor(private http: HttpClient
              // , public jwtHelper: JwtHelper
  ) {
    this.apiBaseUrl = environment.balanceApiUrl;
  }

  loginViaTelegram(loginData: TelegramToBalanceAuthDto): Observable<any> {
    return this.http.post(this.apiBaseUrl + 'auth/telegram ', loginData);
  }

  setToken(token : any) {
    localStorage.setItem(LocalStorageManager.tokenKey, token)
  }

  public removeCurrentToken() {
    localStorage.removeItem(LocalStorageManager.tokenKey);
  }

  public getToken(): string | null {
    return localStorage.getItem(LocalStorageManager.tokenKey);
  }

  public isAuthenticated(): boolean {
    const token = this.getToken();
    if (token == null)
      return false;

    // return !this.jwtHelper.isTokenExpired(token);
    return false;
  }
}
