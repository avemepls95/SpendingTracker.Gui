import { HttpInterceptor, HttpHandler, HttpRequest, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ErrorReponseHandler } from './ErrorReponseHandler';

@Injectable()
export class ResponseInterceptor implements HttpInterceptor {
    constructor(
        private errorReponseHandler: ErrorReponseHandler
    ) { }

    intercept(
        req: HttpRequest<any>,
        next: HttpHandler
    ): Observable<HttpEvent<any>> {

        return next.handle(req).pipe(
            tap(evt => { }),
            catchError((err: any) => {
                return this.errorReponseHandler.handle(req, err);
            }));
    }
}
