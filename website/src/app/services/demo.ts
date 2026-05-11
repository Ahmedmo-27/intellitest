import { Injectable } from '@angular/core';
import { ApiConfig } from './api-config';

@Injectable({
  providedIn: 'root'
})
export class DemoService {
  constructor(private config: ApiConfig) {}

  async postJson(endpoint: string, payload: any) {
    const response = await fetch(this.config.getApiUrl(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Keep original HTTP status message
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  async requestTestCases(payload: any) {
    const data = await this.postJson(this.config.ENDPOINTS.GENERATE_TESTCASES, payload);
    return Array.isArray(data.testCases) ? data.testCases : [];
  }

  async requestTestCode(payload: any) {
    const data = await this.postJson(this.config.ENDPOINTS.GENERATE_TESTS, payload);
    return data.script || null;
  }
}
