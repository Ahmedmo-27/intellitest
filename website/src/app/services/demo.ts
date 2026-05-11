import { Injectable } from '@angular/core';
import { ApiConfig } from './api-config';
import { AuthService } from './auth.service';

export type ProjectSummary = {
  projectId: string;
  name?: string;
  type?: string;
  techStack?: {
    language?: string;
    framework?: string;
    extras?: string[];
  };
  updatedAt?: string;
  createdAt?: string;
};

export type FeatureRelationshipRow = {
  source: string;
  target: string;
  type: string;
  confidence?: number;
};

export type FeatureWeightEntry = {
  weight: number;
  connectivity?: number;
  importance?: number;
  coverage?: number | null;
};

export type ProjectGraphResponse = {
  projectId: string;
  relationships: FeatureRelationshipRow[];
  weights: Record<string, FeatureWeightEntry>;
  coreFeatures: string[];
  weightedCoverage?: number | null;
  weightingModel?: string;
};

@Injectable({
  providedIn: 'root'
})
export class DemoService {
  constructor(private config: ApiConfig, private auth: AuthService) {}

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.auth.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async postJson(endpoint: string, payload: any) {
    const response = await fetch(this.config.getApiUrl(endpoint), {
      method: 'POST',
      headers: this.buildHeaders(),
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

  async getJson(endpoint: string) {
    const response = await fetch(this.config.getApiUrl(endpoint), {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
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

  async requestProjects(): Promise<ProjectSummary[]> {
    const data = await this.getJson(this.config.ENDPOINTS.PROJECTS);
    return Array.isArray(data.projects) ? data.projects : [];
  }

  async requestProjectGraph(projectId: string): Promise<ProjectGraphResponse> {
    const response = await fetch(this.config.getProjectRelationshipsUrl(projectId), {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // Keep original HTTP status message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }
}
