const API_CONFIG = {
	BASE_URL: (typeof window !== 'undefined' && window.API_BASE_URL) || 'http://localhost:3000',
	ENDPOINTS: {
		GENERATE_TESTCASES: '/generate-testcases',
		GENERATE_TESTS: '/generate-tests',
		ANALYZE_FAILURE: '/analyze-failure',
	},
};

function getApiUrl(endpoint) {
	return `${API_CONFIG.BASE_URL}${endpoint}`;
}

async function postJson(endpoint, payload) {
	const response = await fetch(getApiUrl(endpoint), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

		try {
			const errorData = await response.json();
			errorMessage = errorData.error || errorMessage;
		} catch {
			// Keep the HTTP status message when the error body is not JSON.
		}

		throw new Error(errorMessage);
	}

	return response.json();
}

export async function requestTestCases(payload) {
	const data = await postJson(API_CONFIG.ENDPOINTS.GENERATE_TESTCASES, payload);
	return Array.isArray(data.testCases) ? data.testCases : [];
}

export async function requestTestCode(payload) {
	const data = await postJson(API_CONFIG.ENDPOINTS.GENERATE_TESTS, payload);
	return data.script || null;
}
