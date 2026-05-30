import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SigninService } from '../services/signin.service';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private signinService: SigninService, private router: Router) {}

  canActivate(): boolean {
    const token = this.signinService.token?.token;
    if (token && token !== '{}') {
      return true;
    }
    this.router.navigate(['/signin']);
    return false;
  }
}