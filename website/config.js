/**
 * Frontend Configuration
 * Specifies the backend API URL and other client-side settings
 */

export const API_CONFIG = {
  // Backend API base URL - update this based on your environment
  // For local development: http://localhost:3000
  // For production: https://api.your-app.com
  // You can override this in the browser by setting window.API_BASE_URL
  BASE_URL: (typeof window !== 'undefined' && window.API_BASE_URL) || 'http://localhost:3000',

  // API endpoints
  ENDPOINTS: {
    GENERATE_TESTCASES: '/generate-testcases',
    GENERATE_TESTS: '/generate-tests',
    ANALYZE_FAILURE: '/analyze-failure',
  },
};

/**
 * Get the full URL for an API endpoint
 */
export function getApiUrl(endpoint) {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}
