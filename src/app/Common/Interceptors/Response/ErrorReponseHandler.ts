// import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
// import { Injectable } from '@angular/core';
// import { Router } from '@angular/router';
// import { Observable, of } from 'rxjs';
// import { AuthService } from '../../Services/auth.service';
// import { SnackbarService } from '../../Services/snackbar.service';
// import { ResponseCode } from '../../Utils/ResponseCode.enum';
//
// @Injectable({
//     providedIn: 'root'
// })
// export class ErrorReponseHandler {
//     constructor(
//         public snackbarService: SnackbarService,
//         private router: Router,
//         private authService: AuthService
//     ) { }
//
//     handle(request: HttpRequest<any>, errorResponse: HttpErrorResponse): Observable<any> {
//         var systemKey = request.headers.get('system');
//         if (!systemKey)
//             throw new Error('Empty or invalid system header');
//
//         if (systemKey == 'balance')
//            return this.handleBalanceError(errorResponse);
//
//         return this.handleTicketsError(errorResponse);
//     }
//
//     private handleBalanceError(errorResponse: HttpErrorResponse): Observable<any> {
//         if (!(errorResponse instanceof HttpErrorResponse))
//             return of(errorResponse);
//
//         if (errorResponse.status === 401) {
//             this.snackbarService.showErrorMessage('Ошибка авторизации');
//             return of(errorResponse);
//         }
//
//         if (errorResponse.status === 403) {
//             this.authService.removeCurrentToken();
//             this.router.navigate(['/auth']);
//             this.snackbarService.showErrorMessage('Доступ запрещен');
//             return of(errorResponse);
//         }
//
//         if (errorResponse.status === 404) {
//             if (errorResponse.error.error.code == 'check_not_found') {
//                 this.snackbarService.showErrorMessage('Ошибка. Чек не найден!');
//                 return of(errorResponse);
//             }
//         }
//
//         if (errorResponse.status === 422) {
//             if (errorResponse.error.error.code == 'reminder_already_send') {
//                 this.snackbarService.showErrorMessage('Нельзя напоминать о долге чаще, чем раз в каленарный день!');
//                 return of(errorResponse);
//             }
//         }
//
//         if (errorResponse.error.error.code == ResponseCode.ValidationFailed) {
//             this.snackbarService.showErrorMessage('Ошибка валидации');
//             return of(errorResponse);
//         }
//
//         if (errorResponse.url.includes('auth') && errorResponse.status == 0)
//             throw errorResponse;
//
//         this.snackbarService.showErrorMessage('Упс! Что-то пошло не так');
//         return of(errorResponse);
//     }
//
//     private handleTicketsError(errorResponse: HttpErrorResponse): Observable<any> {
//         if (!(errorResponse instanceof HttpErrorResponse))
//             return of(errorResponse);
//
//         if (errorResponse.status === 401) {
//             this.snackbarService.showErrorMessage('Ошибка авторизации');
//             return of(errorResponse);
//         }
//
//         if (errorResponse.status === 403) {
//             this.snackbarService.showErrorMessage('Доступ запрещен');
//             return of(errorResponse);
//         }
//
//         if (errorResponse.status === 404) {
//             this.snackbarService.showErrorMessage('Ошибка. Задача не найдена!');
//             return of(errorResponse);
//         }
//
//         if (errorResponse.url.includes('auth') && errorResponse.status == 0)
//             throw errorResponse;
//
//         if (!errorResponse.error.errors) {
//             this.snackbarService.showErrorMessage("Сервер недоступен");
//             return of(errorResponse);
//         }
//
//         var messages = errorResponse.error.errors.map(keyMessage => keyMessage.message);
//         var resultMessage = '';
//         if (messages.length == 1) {
//             resultMessage = messages[0];
//         } else {
//             messages.forEach((message: string) => {
//                 resultMessage = resultMessage.concat(`- ${message}\n`);
//             });
//         }
//
//         this.snackbarService.showErrorMessage(resultMessage);
//         return of(errorResponse);
//     }
// }
