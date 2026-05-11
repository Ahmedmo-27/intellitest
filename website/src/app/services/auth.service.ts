import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiConfig } from './api-config';

export interface AuthUser {
  id?: string;
  email?: string;
  name?: string;
}

interface LoginResponse {
  token: string;
  user?: AuthUser;
}

interface SignupResponse {
  token: string;
  user?: AuthUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenKey = 'intellitest.auth.token';
  private readonly userKey = 'intellitest.auth.user';
  private readonly isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  private token: string | null = this.readToken();
  private lastValidatedAt = 0;
  private readonly validationTtlMs = 5 * 60 * 1000;

  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.readUser());
  readonly user$ = this.userSubject.asObservable();

  private readonly authStateSubject = new BehaviorSubject<boolean>(!!this.token);
  readonly isAuthenticated$ = this.authStateSubject.asObservable();

  constructor(private config: ApiConfig) {}

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const response = await fetch(this.config.getApiUrl(this.config.ENDPOINTS.AUTH_LOGIN), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }

    const data = (await response.json()) as LoginResponse;
    if (!data?.token) {
      throw new Error('Login failed. Missing token.');
    }

    const user = data.user ?? { email };
    this.setAuth(data.token, user);
    this.lastValidatedAt = Date.now();
    return user;
  }

  async signup(name: string, email: string, password: string): Promise<AuthUser> {
    const response = await fetch(this.config.getApiUrl(this.config.ENDPOINTS.AUTH_SIGNUP), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }

    const data = (await response.json()) as SignupResponse;
    if (!data?.token) {
      throw new Error('Sign up failed. Missing token.');
    }

    const user = data.user ?? { email, name };
    this.setAuth(data.token, user);
    this.lastValidatedAt = Date.now();
    return user;
  }

  logout() {
    this.setAuth(null, null);
  }

  async validateSession(force = false): Promise<boolean> {
    if (!this.token) {
      this.setAuth(null, null);
      return false;
    }

    if (!force && Date.now() - this.lastValidatedAt < this.validationTtlMs) {
      return true;
    }

    try {
      const response = await fetch(this.config.getApiUrl(this.config.ENDPOINTS.AUTH_ME), {
        headers: this.buildAuthHeaders(),
      });

      if (!response.ok) {
        this.setAuth(null, null);
        return false;
      }

      const data = (await response.json()) as { user?: AuthUser };
      this.setAuth(this.token, data.user ?? this.userSubject.value);
      this.lastValidatedAt = Date.now();
      return true;
    } catch {
      return !!this.token;
    }
  }

  private buildAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private normalizeEmail(email: string): string {
    return String(email || '').trim().toLowerCase();
  }

  private setAuth(token: string | null, user: AuthUser | null) {
    this.token = token;
    this.authStateSubject.next(!!token);
    this.userSubject.next(user);

    if (!this.isBrowser) {
      return;
    }

    if (token) {
      window.localStorage.setItem(this.tokenKey, token);
    } else {
      window.localStorage.removeItem(this.tokenKey);
    }

    if (user) {
      window.localStorage.setItem(this.userKey, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(this.userKey);
    }
  }

  private readToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return window.localStorage.getItem(this.tokenKey);
  }

  private readUser(): AuthUser | null {
    if (!this.isBrowser) {
      return null;
    }
    const raw = window.localStorage.getItem(this.userKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  private async readErrorMessage(response: Response): Promise<string> {
    const fallback = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const data = await response.json();
      return data.message || data.error || fallback;
    } catch {
      return fallback;
    }
  }
}
