import {Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { LoaderService } from 'src/app/Common/Services/loader.service';
import { LocalStorageManager } from 'src/app/LocalStorageManager';
import {AuthService} from "./Services/auth.service";
import {AuthByTelegramResponse} from "./Contracts/AuthByTelegramResponse";
import {finalize} from "rxjs/operators";
import {HttpErrorResponse} from "@angular/common/http";
import {TelegramAuthDto} from "./Contracts/TelegramAuthDto";

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit {

  isAuthError: boolean = false;
  fromTelegramWebApp: boolean;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    public loaderService: LoaderService,
    private ngZone: NgZone) { }

  ngOnInit() {
    if (this.authService.isAuthenticated()){
      this.router.navigate(['/main']);
    }

    let telegramWebApp = (window as any).Telegram.WebApp;
    let userData = telegramWebApp.initDataUnsafe.user;
    this.fromTelegramWebApp = !!userData;
    if (this.fromTelegramWebApp) {
      LocalStorageManager.setIsFromTelegramWebApp(true);
      this.login(telegramWebApp);
    }
  }

  login(telegramWebApp: any) {
    let userData = telegramWebApp.initDataUnsafe.user;
    let body = new TelegramAuthDto({
      firstName: userData.first_name,
      userId: userData.id,
      lastName: userData.last_name,
      username: userData.username,
      checkString: telegramWebApp.initData,
      authType: 'webApp'
    });

    this.authService.generateTokenByTelegramAuth(body)
      .pipe(
        finalize(() => {
          this.loaderService.hide();
        })
      )
      .subscribe(
        (response: AuthByTelegramResponse) => {
          this.loginSuccessful(response);
        },
        (error: any) => {
          if (error instanceof HttpErrorResponse) {
            this.isAuthError = true;
          }
        }
      );
  }

  setIsAuthError(value: boolean) {
    this.isAuthError = value;
    this.cdRef.detectChanges();
  }

  loginStarted() {
    this.loaderService.show();
  }

  loginEnded() {
    this.loaderService.hide();
  }

  loginSuccessful(response: AuthByTelegramResponse) {
    this.authService.saveTokenInformation(response.tokenInformation);
    LocalStorageManager.setUserLocalInformation(response.id);

    this.ngZone.run(() => this.router.navigate(['/main']));
  }
}
