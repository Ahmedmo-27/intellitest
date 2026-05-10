import { Routes } from '@angular/router';
import { Landing } from './components/landing/landing';
import { About } from './components/about/about';
import { Faq } from './components/faq/faq';
import { Demo } from './components/demo/demo';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'about', component: About },
  { path: 'faq', component: Faq },
  { path: 'demo', component: Demo },
  { path: '**', redirectTo: '' }
];
