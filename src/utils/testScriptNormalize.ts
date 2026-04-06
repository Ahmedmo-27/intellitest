import type { TestScriptSuggestion } from '../types/testCases';

export type LooseScript = {
	framework?: string;
	language?: string;
	filename?: string;
	code?: string;
	codeLines?: string[];
	script?: LooseScript;
};

/**
 * Basename only; strips path segments the model may include.
 */
export function sanitizeTestFilename(name: string): string {
	const trimmed = name.trim();
	const base = trimmed.replace(/^.*[/\\]/, '').replace(/[/\\]/g, '');
	return base || 'generated.test.js';
}

function extractCodeLinesFromObject(obj: Record<string, unknown>): string | null {
	if (Array.isArray(obj.codeLines) && obj.codeLines.length > 0) {
		return obj.codeLines.map(x => String(x ?? '')).join('\n');
	}
	return null;
}

/**
 * Unwrap nested JSON / markdown so the panel shows source only.
 */
export function extractCodeFromString(text: string): string {
	let t = text.trim();
	const fenceAny = /```(?:json)?\s*([\s\S]*?)```/im;
	const fm = t.match(fenceAny);
	if (fm) {
		t = fm[1].trim();
	}

	if (t.startsWith('{')) {
		try {
			const obj = JSON.parse(t) as Record<string, unknown>;
			const fromLines = extractCodeLinesFromObject(obj);
			if (fromLines != null) {
				return fromLines.trim();
			}
			if (typeof obj.code === 'string' && obj.code.trim()) {
				return extractCodeFromString(obj.code);
			}
			if (obj.script != null && typeof obj.script === 'object') {
				return extractCodeFromObject(obj.script as Record<string, unknown>);
			}
		} catch {
			/* use raw */
		}
	}

	return text.trim();
}

function extractCodeFromObject(r: LooseScript | Record<string, unknown>): string {
	const o = r as Record<string, unknown>;
	const lines = extractCodeLinesFromObject(o);
	if (lines != null) {
		return lines.trim();
	}
	if (typeof o.code === 'string' && o.code.trim()) {
		return extractCodeFromString(o.code);
	}
	if (o.script != null && typeof o.script === 'object') {
		return extractCodeFromObject(o.script as Record<string, unknown>);
	}
	return '';
}

/**
 * Normalize API / LLM script payload to a single code string + safe filename.
 */
export function normalizeLooseScript(raw: LooseScript | null | undefined): TestScriptSuggestion | null {
	if (!raw) {
		return null;
	}

	let code = '';
	if (Array.isArray(raw.codeLines) && raw.codeLines.length > 0) {
		code = raw.codeLines.map(l => String(l ?? '')).join('\n');
	} else if (typeof raw.code === 'string') {
		code = extractCodeFromString(raw.code);
	} else if (raw.script) {
		code = extractCodeFromObject(raw.script);
	}

	if (!code.trim()) {
		return null;
	}

	return {
		framework: String(raw.framework ?? 'unknown'),
		language: String(raw.language ?? 'unknown'),
		filename: sanitizeTestFilename(String(raw.filename ?? 'generated.test.js')),
		code: code.trim()
	};
}
