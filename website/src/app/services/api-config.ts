import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiConfig {
  public readonly BASE_URL = (typeof window !== 'undefined' && (window as any).API_BASE_URL) || 'http://localhost:3000';
  public readonly ENDPOINTS = {
    GENERATE_TESTCASES: '/generate-testcases',
    GENERATE_TESTS: '/generate-tests',
    ANALYZE_FAILURE: '/analyze-failure',
  };

  getApiUrl(endpoint: string): string {
    return `${this.BASE_URL}${endpoint}`;
  }
}
