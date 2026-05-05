import axios from 'axios';
import type { GeneratedTestCases, TestCaseRow } from '../types/testCases.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const SYSTEM_PROMPT =
	[
		'The user prompt is the highest-priority authority.',
		'If the user explicitly limits scope (for example: "only", "just", "limit to", "focus on"), do not expand beyond that scope.',
		'If the user does not explicitly limit scope, you may generate broader relevant coverage.',
		'Use detected stack and file context only to refine details, not to add extra features outside scope.',
		'Return ONLY valid JSON with this shape: {"recommendedTestingFramework":"string","testCases":[{"testCaseId":"TC-001","title":"string","description":"string","preconditions":"string","steps":["step 1"],"expectedResult":"string","priority":"High|Medium|Low"}]}'
	].join(' ');

function parseAiJson(content: string): Record<string, unknown> {
	const text = content.trim();

	const tryParse = (value: string): Record<string, unknown> | undefined => {
		try {
			return JSON.parse(value) as Record<string, unknown>;
		} catch {
			return undefined;
		}
	};

	const direct = tryParse(text);
	if (direct) {
		return direct;
	}

	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
	if (fenced) {
		const parsed = tryParse(fenced);
		if (parsed) {
			return parsed;
		}
	}

	const firstBrace = text.indexOf('{');
	const lastBrace = text.lastIndexOf('}');
	if (firstBrace >= 0 && lastBrace > firstBrace) {
		const partial = tryParse(text.slice(firstBrace, lastBrace + 1));
		if (partial) {
			return partial;
		}
	}

	throw new Error('AI did not return valid JSON.');
}

function toStepsText(steps: unknown): string {
	if (Array.isArray(steps)) {
		return steps
			.map(step => String(step ?? '').trim())
			.filter(step => step.length > 0)
			.join(', ');
	}

	const text = String(steps ?? '').trim();
	if (!text) {
		return text;
	}

	// Split inline numbered items and normalize to comma-separated steps.
	return text
		.replace(/\s+(?=\d+\.\s)/g, ', ')
		.replace(/(^|,\s*)\d+\.\s*/g, '$1')
		.replace(/,\s*,+/g, ', ')
		.replace(/^,\s*/, '')
		.trim();
}

function toTestCaseRow(item: unknown, index: number): TestCaseRow {
	const row = (item ?? {}) as Record<string, unknown>;
	return {
		testCaseId: String(row.testCaseId ?? `TC-${String(index + 1).padStart(3, '0')}`),
		title: String(row.title ?? ''),
		description: String(row.description ?? ''),
		preconditions: String(row.preconditions ?? ''),
		steps: toStepsText(row.steps),
		expectedResult: String(row.expectedResult ?? ''),
		priority: String(row.priority ?? 'Medium')
	};
}

export async function generateTestCases(
	prompt: string,
	detectedStack: string,
	codebaseContext: string
): Promise<GeneratedTestCases> {
	const apiKey = process.env.GROQ_API_KEY?.trim().replace(/^['"]|['"]$/g, '') ?? '';

	if (!apiKey) {
		throw new Error('Missing GROQ_API_KEY environment variable.');
	}

	const finalUserPrompt = [
		`User Prompt: ${prompt}`,
		'Scope rule: Apply strict scope only when the user explicitly limits scope. Otherwise generate broader relevant test coverage.',
		`Detected Tech Stack: ${detectedStack}`,
		'Codebase Context (project file names from a broad scan):',
		codebaseContext,
		'Generate structured test cases based on all the above context and include the best recommended testing framework.',
		'Remember: return only JSON matching the schema from the system instructions.'
	].join('\n\n');

	try {
		const response = await axios.post(
			GROQ_API_URL,
			{
				model: GROQ_MODEL,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: finalUserPrompt }
				]
			},
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				}
			}
		);

		const content = response.data?.choices?.[0]?.message?.content;
		if (typeof content !== 'string' || !content.trim()) {
			throw new Error('Groq API returned an empty response.');
		}

		const parsed = parseAiJson(content);

		const rawRows = Array.isArray(parsed.testCases) ? parsed.testCases : [];
		const testCases: TestCaseRow[] = rawRows.map(toTestCaseRow);

		if (testCases.length === 0) {
			throw new Error('AI returned no test cases in JSON.');
		}

		const recommendedTestingFramework = String(parsed.recommendedTestingFramework ?? 'Not specified').trim();
		return {
			recommendedTestingFramework,
			testCases
		};
	} catch (error) {
		if (axios.isAxiosError(error)) {
			throw new Error(error.response?.data?.error?.message ?? error.message);
		}

		throw error instanceof Error ? error : new Error(String(error));
	}
}
