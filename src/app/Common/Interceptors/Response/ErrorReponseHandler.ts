import {HttpErrorResponse, HttpHandler, HttpRequest} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {BehaviorSubject, EMPTY, filter, Observable, of, switchMap, take, throwError} from 'rxjs';
import {SnackbarService} from "../../Services/snackbar.service";
import {ErrorResponseObject} from "./ErrorResponseObject";
import {ErrorCodeMessages} from "./ErrorCodeMessages";

@Injectable({
    providedIn: 'root'
})
export class ErrorReponseHandler {

    constructor(
        public snackbarService: SnackbarService,
        private router: Router
    ) { }

    handle(request: HttpRequest<any>, errorResponse: HttpErrorResponse): Observable<any> {
      if (!(errorResponse instanceof HttpErrorResponse))
        return of(errorResponse);

      if (errorResponse.status === 500) {
        this.snackbarService.showErrorMessage("Произошла непредвиденная ошибка");
        return EMPTY;
      }

      if (errorResponse.status === 0) {
        this.snackbarService.showErrorMessage("Сервер недоступен");
        return EMPTY;
      }

      if (errorResponse.status === 401) {
        this.snackbarService.showInformationMessage('Время сессии истекло. Авторизуйтесь заново');
        this.router.navigate(['/auth']);
        return EMPTY;
      }

      if (errorResponse.status === 403) {
        this.snackbarService.showErrorMessage('Доступ запрещен');
        this.router.navigate(['/auth']);
        return EMPTY;
      }

      if (errorResponse.status === 400) {
        let errors = errorResponse.error as ErrorResponseObject[];
        for (let i = 0; i < errors.length; ++i) {
          let error = errors[i];
          let message = error.messageIsCustom
            ? error.message
            : ErrorCodeMessages.Instance.get(error.code)
          this.snackbarService.showErrorMessage(message);
        }

        return EMPTY;
      }

      return of(errorResponse);
    }
}
