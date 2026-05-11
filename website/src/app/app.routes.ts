import { Routes } from '@angular/router';
import { Landing } from './components/landing/landing';
import { About } from './components/about/about';
import { Faq } from './components/faq/faq';
import { Demo } from './components/demo/demo';
import { Login } from './components/login/login';
import { MyProjects } from './components/my-projects/my-projects';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'about', component: About },
  { path: 'faq', component: Faq },
  { path: 'login', component: Login },
  { path: 'my-projects', component: MyProjects, canActivate: [authGuard] },
  { path: 'demo', component: Demo, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
