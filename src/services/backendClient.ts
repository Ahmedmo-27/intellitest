import axios from 'axios';
import type { IntelliGenerationResult, TestCaseRow } from '../types/testCases';
import { buildProjectMap } from './projectMap';

type ServerTestCase = {
	id?: string;
	name?: string;
	description?: string;
	preconditions?: unknown;
	steps?: unknown;
	expected?: string;
	priority?: string;
	tags?: unknown;
};

function stepsToDisplayText(steps: unknown): string {
	if (Array.isArray(steps)) {
		return steps
			.map(s => String(s ?? '').trim())
			.filter(Boolean)
			.map((t, i) => `${i + 1}. ${t}`)
			.join('\n');
	}
	return String(steps ?? '').trim();
}

function toPreconditionsText(value: unknown): string {
	if (Array.isArray(value)) {
		return value.map(v => String(v ?? '').trim()).filter(Boolean).join('; ');
	}
	return String(value ?? '').trim();
}

function mapServerCase(item: ServerTestCase, index: number): TestCaseRow {
	const tags = Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean) : [];
	const descriptionText = String(item.description ?? '').trim();
	const preconditionsText = toPreconditionsText(item.preconditions);
	const fallbackTagLine = tags.length ? `Tags: ${tags.join(', ')}` : '';

	return {
		testCaseId: String(item.id ?? `TC-${String(index + 1).padStart(3, '0')}`),
		title: String(item.name ?? 'Unnamed test'),
		description: descriptionText || fallbackTagLine,
		preconditions: preconditionsText,
		steps: stepsToDisplayText(item.steps),
		expectedResult: String(item.expected ?? ''),
		priority: String(item.priority ?? 'medium')
	};
}

function messageFromResponseData(data: unknown): string | undefined {
	if (data == null || typeof data !== 'object') {
		return undefined;
	}
	const d = data as Record<string, unknown>;
	if (typeof d.detail === 'string' && d.detail.trim()) {
		return d.detail;
	}
	if (typeof d.error === 'string' && d.error.trim()) {
		return d.error;
	}
	const nested = d.error;
	if (nested != null && typeof nested === 'object' && typeof (nested as { message?: unknown }).message === 'string') {
		const m = (nested as { message: string }).message;
		if (m.trim()) {
			return m;
		}
	}
	if (typeof d.message === 'string' && d.message.trim()) {
		return d.message;
	}
	return undefined;
}

function throwAxiosDetail(err: unknown): never {
	if (axios.isAxiosError(err)) {
		if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
			throw new Error(
				'Cannot reach the IntelliTest backend. Start the server (cd Server && npm start) and set Settings → intellitest.backendUrl to the same host and port as Server/.env PORT (e.g. http://localhost:3001 if PORT=3001).'
			);
		}
		const fromBody = err.response?.data != null ? messageFromResponseData(err.response.data) : undefined;
		const msg = fromBody || err.message;
		throw new Error(msg);
	}
	throw err instanceof Error ? err : new Error(String(err));
}

/**
 * Calls /generate-testcases then /generate-tests with the same project map plus structured test cases.
 */
export async function generateViaBackend(
	baseUrl: string,
	workspaceRootPath: string | undefined,
	detectedStack: string,
	userPrompt: string
): Promise<IntelliGenerationResult> {
	const root = baseUrl.replace(/\/$/, '');
	const projectMap = await buildProjectMap(workspaceRootPath, detectedStack, userPrompt);

	let data: { testCases?: ServerTestCase[]; error?: string; detail?: string };
	try {
		const res = await axios.post(`${root}/generate-testcases`, projectMap, {
			timeout: 120_000,
			headers: { 'Content-Type': 'application/json' }
		});
		data = res.data;
	} catch (err) {
		throwAxiosDetail(err);
	}

	if (data?.error) {
		throw new Error(typeof data.detail === 'string' && data.detail ? data.detail : data.error);
	}

	const raw = Array.isArray(data?.testCases) ? data.testCases : [];
	const testCases = raw.map(mapServerCase);

	if (testCases.length === 0) {
		throw new Error('The backend returned no test cases. Check server logs and LLM configuration.');
	}

	return {
		recommendedTestingFramework: '',
		testCases,
		testScript: null
	};
}
