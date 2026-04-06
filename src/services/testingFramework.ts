import * as fs from 'node:fs';
import * as path from 'node:path';

/** When multiple runners are hinted, prefer the first listed here. */
const RUNNER_PRIORITY = [
	'Vitest',
	'Jest',
	'Playwright',
	'Cypress',
	'Mocha',
	'Karma',
	'Jasmine',
	'AVA',
	'node:test',
	'Testing Library'
];

function pickSingleRunner(runners: string[]): string {
	const uniq = [...new Set(runners)].filter(Boolean);
	if (uniq.length === 0) {
		return 'Jest';
	}
	if (uniq.length === 1) {
		return uniq[0] === 'Testing Library' ? 'Jest' : uniq[0];
	}
	for (const p of RUNNER_PRIORITY) {
		if (uniq.includes(p)) {
			return p;
		}
	}
	return uniq[0];
}

/**
 * Short test-runner name for the UI (e.g. "Jest" only — no long sentences).
 */
export function detectRecommendedTestingFramework(workspaceRoot: string | undefined): string {
	if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
		return 'Jest';
	}

	const pkgPath = path.join(workspaceRoot, 'package.json');
	if (fs.existsSync(pkgPath)) {
		try {
			const raw = fs.readFileSync(pkgPath, 'utf8');
			const pkg = JSON.parse(raw) as {
				devDependencies?: Record<string, string>;
				dependencies?: Record<string, string>;
				scripts?: Record<string, string>;
			};
			const all = { ...pkg.dependencies, ...pkg.devDependencies };
			const names = Object.keys(all || {});
			const scripts = pkg.scripts ?? {};
			const scriptBlob = [
				...Object.keys(scripts).map(k => `${k}:${scripts[k]}`),
				...Object.values(scripts)
			].join(' ');

			const runners: string[] = [];

			const vscodeTestStack = names.some(
				n =>
					n.includes('@vscode/test') ||
					n === '@vscode/test-cli' ||
					n === '@vscode/test-electron'
			);
			if (vscodeTestStack) {
				return 'Mocha';
			}

			if (/\bvitest\b/i.test(scriptBlob)) {
				runners.push('Vitest');
			}
			if (/\bjest\b/i.test(scriptBlob) || /jest\.config/i.test(scriptBlob)) {
				runners.push('Jest');
			}
			if (/\bmocha\b/i.test(scriptBlob)) {
				runners.push('Mocha');
			}
			if (/\bcypress\b/i.test(scriptBlob)) {
				runners.push('Cypress');
			}
			if (/\bplaywright\b/i.test(scriptBlob)) {
				runners.push('Playwright');
			}
			if (/\bkarma\b/i.test(scriptBlob)) {
				runners.push('Karma');
			}
			if (/\bava\b|\bnpm run test\b.*ava/i.test(scriptBlob)) {
				runners.push('AVA');
			}
			if (/\bnode\s+--test\b|\bnode:test\b/.test(scriptBlob)) {
				runners.push('node:test');
			}

			if (names.some(n => n === 'jest' || n.startsWith('jest-'))) {
				runners.push('Jest');
			}
			if (names.includes('vitest')) {
				runners.push('Vitest');
			}
			if (names.includes('mocha')) {
				runners.push('Mocha');
			}
			if (names.includes('cypress')) {
				runners.push('Cypress');
			}
			if (names.includes('@playwright/test') || names.includes('playwright')) {
				runners.push('Playwright');
			}
			if (names.includes('karma')) {
				runners.push('Karma');
			}
			if (names.includes('jasmine')) {
				runners.push('Jasmine');
			}
			if (names.includes('ava')) {
				runners.push('AVA');
			}
			if (names.includes('@testing-library/react') || names.includes('@testing-library/vue')) {
				runners.push('Testing Library');
			}

			if (names.includes('@types/jest') && !runners.some(r => r === 'Jest')) {
				runners.push('Jest');
			}
			if (names.includes('@types/mocha') && !runners.some(r => r === 'Mocha')) {
				runners.push('Mocha');
			}

			if (runners.length > 0) {
				return pickSingleRunner(runners);
			}

			// Node/TS project but no runner listed — default recommendation for this tool
			const hasTypescript = names.includes('typescript') || fs.existsSync(path.join(workspaceRoot, 'tsconfig.json'));
			if (hasTypescript || names.includes('tsx') || names.includes('@types/node')) {
				return 'Jest';
			}

			return 'Jest';
		} catch {
			/* fall through */
		}
	}

	const readText = (p: string): string | undefined => {
		try {
			return fs.readFileSync(p, 'utf8');
		} catch {
			return undefined;
		}
	};

	for (const f of ['pyproject.toml', 'requirements.txt', 'setup.cfg']) {
		const txt = readText(path.join(workspaceRoot, f));
		if (txt && /pytest/i.test(txt)) {
			return 'Pytest';
		}
	}

	const pom = readText(path.join(workspaceRoot, 'pom.xml'));
	if (pom && /junit/i.test(pom)) {
		return 'JUnit';
	}

	const gradle = readText(path.join(workspaceRoot, 'build.gradle'));
	const gradleKts = readText(path.join(workspaceRoot, 'build.gradle.kts'));
	if ((gradle && /junit/i.test(gradle)) || (gradleKts && /junit/i.test(gradleKts))) {
		return 'JUnit';
	}

	if (fs.existsSync(path.join(workspaceRoot, 'go.mod'))) {
		return 'go test';
	}

	if (fs.existsSync(path.join(workspaceRoot, 'Cargo.toml'))) {
		return 'cargo test';
	}

	return 'Jest';
}
