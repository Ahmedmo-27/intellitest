import { Component } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, NgIf, AsyncPipe],
  templateUrl: './nav.html',
  styleUrl: './nav.css'
})
export class Nav {
  constructor(public auth: AuthService) {}

  logout() {
    this.auth.logout();
  }
}
