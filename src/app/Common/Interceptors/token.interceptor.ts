import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import {EMPTY, Observable} from 'rxjs';
import {AuthService} from "../Auth/Services/auth.service";

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  constructor(public auth: AuthService, private router: Router) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (request.url.includes('/auth/')) {
      return next.handle(request);
    }

    const token = this.auth.getTokenFromStorage();
    if (!token) {
      this.router.navigate(['/auth']);
      return EMPTY;
    }

    const authRequest = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next.handle(authRequest);
  }
}

