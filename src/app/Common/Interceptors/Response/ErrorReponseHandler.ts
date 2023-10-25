import {HttpErrorResponse, HttpHandler, HttpRequest} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {BehaviorSubject, EMPTY, filter, Observable, of, switchMap, take, throwError} from 'rxjs';
import {AuthService} from "../../Auth/Services/auth.service";

@Injectable({
    providedIn: 'root'
})
export class ErrorReponseHandler {

    constructor(
        // public snackbarService: SnackbarService,
        private router: Router,
    ) { }

    handle(request: HttpRequest<any>, errorResponse: HttpErrorResponse): Observable<any> {
      if (!(errorResponse instanceof HttpErrorResponse))
        return of(errorResponse);

      if (errorResponse.status === 401) {
        this.router.navigate(['/auth']);
        return EMPTY;
      }

      if (errorResponse.status === 403) {
        // this.snackbarService.showErrorMessage('Доступ запрещен');
        this.router.navigate(['/auth']);
        return EMPTY;
      }

      return of(errorResponse);
    }
}
