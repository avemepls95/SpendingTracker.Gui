import { Injectable } from '@angular/core';
import { Router, CanActivate, CanLoad } from '@angular/router';
import {AuthService} from "../Auth/Services/auth.service";

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanLoad {
  canLoad(): boolean {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return false;
    }
    return true;
  }

  constructor(public auth: AuthService, public router: Router) { }

  canActivate(): boolean {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return false;
    }
    return true;
  }

}
