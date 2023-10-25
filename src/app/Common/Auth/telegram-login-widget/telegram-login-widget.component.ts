import { Component, AfterViewInit, ElementRef, ViewChild, EventEmitter, Output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { LocalStorageManager } from "../../../LocalStorageManager";
import {FromTelegramAuthDto} from "../Contracts/FromTelegramAuthDto";
import {CommonDtoMapper} from "../../../Converters/CommonDtoMapper";
import {AuthService} from "../Services/auth.service";

@Component({
  selector: 'app-telegram-login-widget',
  template: `
<div #script style="display:none">
  <ng-content></ng-content>
</div>`,
  styleUrls: ['./telegram-login-widget.component.css']
})
export class TelegramLoginWidget implements AfterViewInit {

  @Output()
  isAuthError = new EventEmitter<boolean>();

  @Output()
  loginStarted = new EventEmitter();
  @Output()
  loginEnded = new EventEmitter();
  @Output()
  loginSuccessful = new EventEmitter();

  @ViewChild('script', { static: true }) script: ElementRef;

  constructor(private authService: AuthService, private router: Router) { }

  convertToScript() {
    const element = this.script.nativeElement;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'SpendingMoneyBot');
    script.setAttribute('data-size', 'large');
    // Callback function in global scope
    script.setAttribute('data-onauth', 'loginViaTelegram(user)');
    script.setAttribute('data-request-access', 'write');
    element.parentElement.replaceChild(script, element);
  }

  ngAfterViewInit() {
    // @ts-ignore
      window['loginViaTelegram'] = (loginData: FromTelegramAuthDto) => {
      LocalStorageManager.setUserData(loginData as FromTelegramAuthDto);
      this.loginViaTelegram(loginData)
    };
    this.convertToScript();
  }

  private loginViaTelegram(loginData: FromTelegramAuthDto) {
    this.loginStarted.emit();

    this.authService.generateTokenByTelegramAuth(CommonDtoMapper.getTelegramAuthDto(loginData))
      .pipe(
        finalize(() => {
          this.loginEnded.emit()
        })
      )
      .subscribe(
        (response: any) => {
          this.loginSuccessful.emit(response);
        },
        (error: any) => {
          if (error instanceof HttpErrorResponse) {
            this.isAuthError.emit(true);
          }
        }
      );
  }
}
