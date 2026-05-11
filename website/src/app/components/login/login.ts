import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  loginForm: FormGroup;
  errorMessage = '';
  isSubmitting = false;
  redirectUrl = '/my-projects';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit() {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    this.redirectUrl = redirect && redirect.startsWith('/') ? redirect : '/my-projects';

    void this.redirectIfAuthenticated();
  }

  private async redirectIfAuthenticated() {
    if (await this.auth.validateSession()) {
      await this.router.navigateByUrl(this.redirectUrl);
    }
  }

  get emailInvalid(): boolean {
    const control = this.loginForm.get('email');
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  get passwordInvalid(): boolean {
    const control = this.loginForm.get('password');
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  async submit() {
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      const email = String(this.loginForm.value.email || '').trim();
      const password = String(this.loginForm.value.password || '');
      await this.auth.login(email, password);
      await this.router.navigateByUrl(this.redirectUrl);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Login failed. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
