/**
 * Groq service for generating executable test code from structured test cases.
 *
 * Uses the same Groq OpenAI-compatible endpoint already used by the backend,
 * but called directly from the extension so no backend restart is needed.
 *
 * All credentials are read from environment variables — nothing is hardcoded.
 */

import axios from 'axios';
import type { TestCaseRow } from '../types/testCases.js';

// ── Config ────────────────────────────────────────────────────────────────────

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_ENDPOINT = `${GROQ_BASE_URL}/chat/completions`;
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
	'You are a senior QA automation engineer. ' +
	'Convert the following Excel-based test cases into executable automated test code. ' +
	'Use clear test names, setup steps, actions, expected results, and assertions. ' +
	'Generate clean, complete, runnable code. ' +
	'Return only the code without markdown formatting or code fences.';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts an array of TestCaseRow objects into a readable plain-text block
 * that Groq can understand and convert into test code.
 */
function formatTestCasesAsText(testCases: TestCaseRow[]): string {
	return testCases
		.map((tc, index) => {
			const lines: string[] = [
				`--- Test Case ${index + 1} ---`,
				`ID:             ${tc.testCaseId}`,
				`Title:          ${tc.title}`,
			];

			if (tc.description?.trim()) {
				lines.push(`Description:    ${tc.description}`);
			}
			if (tc.preconditions?.trim()) {
				lines.push(`Preconditions:  ${tc.preconditions}`);
			}
			if (tc.steps?.trim()) {
				// Steps may be multi-line — indent continuation lines
				const stepsFormatted = tc.steps
					.split('\n')
					.map((s, i) => (i === 0 ? `Steps:          ${s}` : `                ${s}`))
					.join('\n');
				lines.push(stepsFormatted);
			}
			if (tc.expectedResult?.trim()) {
				lines.push(`Expected Result: ${tc.expectedResult}`);
			}
			if (tc.priority?.trim()) {
				lines.push(`Priority:       ${tc.priority}`);
			}
			if (tc.comments?.trim()) {
				lines.push(`Comments:       ${tc.comments}`);
			}

			return lines.join('\n');
		})
		.join('\n\n');
}

/**
 * Strips any markdown code fences the model may have added despite instructions.
 */
function stripMarkdownFences(text: string): string {
	return text
		.replace(/^```[\w]*\r?\n?/m, '')
		.replace(/\r?\n?```$/m, '')
		.trim();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Calls Groq to generate executable test code from the given test cases.
 *
 * @param testCases  - Structured test cases (from memory or parsed Excel)
 * @param framework  - Detected testing framework hint (e.g. "Jest", "Pytest")
 * @param apiKey     - Groq API key (process.env.API_KEY)
 * @param model      - Groq model ID (process.env.API_MODEL)
 * @returns Raw test code string ready to be saved to a file
 */
export async function generateTestCodeWithGroq(
	testCases: TestCaseRow[],
	framework: string,
	apiKey: string,
	model: string = DEFAULT_MODEL
): Promise<string> {
	// ── Validation ────────────────────────────────────────────────────────────

	if (!apiKey?.trim()) {
		throw new Error(
			'Groq API key is missing.\n' +
			'Add API_KEY=your_groq_key to Server/.env.'
		);
	}

	if (!testCases || testCases.length === 0) {
		throw new Error(
			'No test cases available to generate code from.\n' +
			'Generate test cases first, then click "Generate Test Code".'
		);
	}

	// ── Build prompt ──────────────────────────────────────────────────────────

	const formattedCases = formatTestCasesAsText(testCases);

	const frameworkHint =
		framework &&
		framework !== 'Not generated yet' &&
		framework !== 'Not specified' &&
		framework !== 'Not detected yet'
			? `\nTarget testing framework: ${framework}\n`
			: '';

	const userPrompt =
		`Generate executable automated test code for the following test cases.${frameworkHint}\n` +
		`Return only the raw code — no markdown, no explanation, no code fences.\n\n` +
		`TEST CASES:\n${formattedCases}`;

	// ── API call ──────────────────────────────────────────────────────────────

	try {
		const response = await axios.post(
			GROQ_ENDPOINT,
			{
				model: model.trim() || DEFAULT_MODEL,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: userPrompt }
				],
				temperature: 0.1,   // Low temperature → deterministic, clean code
				max_tokens: 4096
			},
			{
				timeout: 120_000,
				headers: {
					Authorization: `Bearer ${apiKey.trim()}`,
					'Content-Type': 'application/json'
				}
			}
		);

		const content: unknown = response.data?.choices?.[0]?.message?.content;

		if (typeof content !== 'string' || !content.trim()) {
			throw new Error(
				'Groq returned an empty response. The model may have refused the request. Please try again.'
			);
		}

		return stripMarkdownFences(content);

	} catch (err) {
		if (axios.isAxiosError(err)) {
			const status = err.response?.status;
			const body = err.response?.data as Record<string, unknown> | undefined;

			// Extract the most useful error message from the response body
			const apiMsg =
				typeof body?.error === 'object' && body.error !== null
					? String((body.error as Record<string, unknown>).message ?? '')
					: typeof body?.message === 'string'
					? body.message
					: '';

			if (status === 401) {
				throw new Error(
					'Groq API key is invalid or expired.\n' +
					'Check API_KEY in Server/.env.'
				);
			}
			if (status === 429) {
				throw new Error(
					'Groq rate limit reached. Please wait a moment and try again.'
				);
			}
			if (status === 400) {
				throw new Error(
					`Groq rejected the request (400)${apiMsg ? ': ' + apiMsg : ''}.\n` +
					'The prompt may be too long. Try generating fewer test cases.'
				);
			}

			throw new Error(
				apiMsg
					? `Groq API error (${status ?? '?'}): ${apiMsg}`
					: `Groq request failed: ${err.message}`
			);
		}

		throw err instanceof Error ? err : new Error(String(err));
	}
}
