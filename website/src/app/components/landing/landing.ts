import { Component, ViewEncapsulation } from '@angular/core';
import { Hero } from '../hero/hero';

@Component({
  selector: 'app-landing',
  imports: [Hero],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  encapsulation: ViewEncapsulation.None
})
export class Landing {}
