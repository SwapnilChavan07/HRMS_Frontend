import { Routes } from '@angular/router';
import { LoginPage } from './login-page';
import { MfaPage } from './mfa-page';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'mfa', component: MfaPage },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
