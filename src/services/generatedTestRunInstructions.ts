/**
 * Stack-aware Markdown for running Debuggo-generated tests locally.
 */

export const GENERATED_TESTS_RUN_GUIDE_FILENAME = 'HOW_TO_RUN_GENERATED_TESTS.md';

/** Written under generated-tests/ when saving `.ts` / `.tsx` tests so the IDE knows Jest globals. */
export const GENERATED_TESTS_TSCONFIG_FILENAME = 'tsconfig.json';

export type GeneratedTestRunRecipe =
	| 'pytest'
	| 'junit'
	| 'jest-react'
	| 'jest-js'
	| 'vitest-react'
	| 'generic';

export function resolveGeneratedTestRunRecipe(
	detectedStack: string,
	recommendedFramework: string,
	testFilename: string
): GeneratedTestRunRecipe {
	const fw = recommendedFramework.toLowerCase();
	const stack = detectedStack.toLowerCase();
	const ext = testFilename.toLowerCase();

	if (fw.includes('pytest') || fw.includes('python') || ext.endsWith('.py')) {
		return 'pytest';
	}
	if (fw.includes('junit') || fw.includes('java') || ext.endsWith('.java')) {
		return 'junit';
	}
	if (fw.includes('vitest') || stack.includes('vitest')) {
		return 'vitest-react';
	}
	const reactHint =
		stack.includes('react') ||
		fw.includes('react') ||
		fw.includes('testing-library') ||
		fw.includes('@testing-library') ||
		ext.endsWith('.jsx') ||
		ext.endsWith('.tsx');
	if (reactHint) {
		return 'jest-react';
	}
	if (fw.includes('jest')) {
		return 'jest-js';
	}
	return 'generic';
}

function header(detectedStack: string, recommendedFramework: string, relativePath: string): string {
	return [
		'# How to run generated tests',
		'',
		`Generated test file: \`${relativePath}\``,
		`- Detected stack: ${detectedStack || '(unknown)'}`,
		`- Recommended framework hint: ${recommendedFramework || '(unknown)'}`,
		'',
		'Run commands from your **project root** (the workspace folder), not from inside `generated-tests/`.',
		''
	].join('\n');
}

function jestReactBody(relativePath: string): string {
	return [
		'## Jest + React / JSX (React Testing Library)',
		'',
		'Do **not** run the file with plain `node` — JSX must be transpiled and `describe` / `jest` come from Jest.',
		'',
		'### 1. Install dev dependencies',
		'',
		'```bash',
		'npm install -D jest jest-environment-jsdom babel-jest @babel/core @babel/preset-env @babel/preset-react \\',
		'  @testing-library/react @testing-library/jest-dom',
		'```',
		'',
		'*(Jest 28+ does not ship `jest-environment-jsdom`; it must be installed separately.)*',
		'',
		'### 2. Add `babel.config.cjs` at the project root',
		'',
		'Use `.cjs` if your `package.json` has `"type": "module"`.',
		'',
		'```js',
		'module.exports = {',
		'  presets: [',
		"    ['@babel/preset-env', { targets: { node: 'current' } }],",
		"    ['@babel/preset-react', { runtime: 'automatic' }],",
		'  ],',
		'};',
		'```',
		'',
		'### 3. Add `jest.config.cjs` at the project root',
		'',
		'If imports use a alias like `client/src/...` (as Vite does), map it to disk — **or** change imports in the generated file to relative paths (`../client/src/...`). Example mapper:',
		'',
		'```js',
		'module.exports = {',
		"  testEnvironment: 'jsdom',",
		'  transform: {',
		"    '^.+\\\\.[jt]sx?$': 'babel-jest',",
		'  },',
		'  moduleNameMapper: {',
		"    '^client/(.*)$': '<rootDir>/client/$1',",
		'  },',
		'};',
		'```',
		'',
		"If the test uses `jest.mock('axios')` or imports `axios`, run `npm install axios` (Jest still resolves that package). Prefer mocking your own API module (e.g. `cartApi`) instead.",
		'',
		'### 4. Run this file',
		'',
		'```bash',
		`npx jest ${relativePath}`,
		'```',
		''
	].join('\n');
}

function jestJsBody(relativePath: string): string {
	return [
		'## Jest (JavaScript, no JSX)',
		'',
		'```bash',
		'npm install -D jest',
		'```',
		'',
		'If the generated file uses DOM APIs, also install `jest-environment-jsdom` and set `testEnvironment: \'jsdom\'` in `jest.config.cjs`.',
		'',
		'```bash',
		`npx jest ${relativePath}`,
		'```',
		''
	].join('\n');
}

function vitestReactBody(relativePath: string): string {
	return [
		'## Vitest + React',
		'',
		'```bash',
		'npm install -D vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom',
		'```',
		'',
		'Add a `vitest.config.ts` / `vitest.config.js` with the React plugin and `environment: \'jsdom\'` as in the [Vitest docs](https://vitest.dev/guide/environment.html).',
		'',
		'```bash',
		`npx vitest run ${relativePath}`,
		'```',
		''
	].join('\n');
}

function pytestBody(relativePath: string): string {
	return [
		'## pytest (Python)',
		'',
		'```bash',
		'pip install pytest',
		`pytest ${relativePath}`,
		'```',
		''
	].join('\n');
}

function junitBody(relativePath: string): string {
	return [
		'## JUnit (Java)',
		'',
		'Place or reference the generated class according to your Maven/Gradle layout (`src/test/java/...`).',
		'',
		'- **Maven:** `mvn test` (optionally `-Dtest=ClassName`)',
		'- **Gradle:** `./gradlew test`',
		'',
		`Generated path for reference: \`${relativePath}\``,
		''
	].join('\n');
}

function typescriptIdeSection(testFilename: string, recipe: GeneratedTestRunRecipe): string {
	if (!/\.tsx?$/i.test(testFilename)) {
		return '';
	}
	const isTsx = testFilename.toLowerCase().endsWith('.tsx');

	if (recipe === 'vitest-react') {
		return [
			'## TypeScript / VS Code (Vitest globals)',
			'',
			'Install typings used by Vitest + React tests:',
			'',
			'```bash',
			'npm install -D vitest @types/node',
			'```',
			isTsx
				? [
						'',
						'```bash',
						'npm install -D @types/react @types/react-dom',
						'```',
						''
					].join('\n')
				: '\n',
			'Use `/// <reference types="vitest/globals" />` at the top of the spec if your Vitest config exposes globals.',
			'',
			'Debuggo writes `generated-tests/tsconfig.json` with `vitest` in `compilerOptions.types` for this folder.',
			''
		].join('\n');
	}

	return [
		'## TypeScript / VS Code (Cannot find name `describe`, `expect`, implicit `any`)',
		'',
		'Generated `.ts` / `.tsx` specs need **Jest typings** (and React typings for `.tsx`). Debuggo also adds `generated-tests/tsconfig.json` so this folder includes Jest globals.',
		'',
		'### Install typings',
		'',
		'```bash',
		'npm install -D @types/jest @types/node',
		'```',
		isTsx
			? [
					'',
					'For `.tsx` (React imports / JSX in tests):',
					'',
					'```bash',
					'npm install -D @types/react @types/react-dom',
					'```',
					''
				].join('\n')
			: '\n',
		'If the test uses **Puppeteer** (`browser`, `page`):',
		'',
		'```bash',
		'npm install -D @types/puppeteer',
		'```',
		'',
		'Prefer explicit types: `import puppeteer, { type Browser, type Page } from \'puppeteer\'` (or typed variables) instead of untyped `let browser`.',
		'',
		'For **Playwright**, use `import { test, expect } from \'@playwright/test\'` and its runner — do not mix bare Jest globals with Playwright unless the project is configured for that.',
		'',
		'After installing packages, run **Developer: Reload Window** if diagnostics stay stale.',
		''
	].join('\n');
}

/**
 * `generated-tests/tsconfig.json` — narrow config so `describe` / `expect` resolve without changing the whole repo.
 */
export function buildGeneratedTestsTsConfigJson(opts: {
	extendsParentTsconfig: boolean;
	testFilename: string;
	code: string;
	recipe: GeneratedTestRunRecipe;
}): string {
	const { extendsParentTsconfig, testFilename, code, recipe } = opts;
	const isTsx = testFilename.toLowerCase().endsWith('.tsx');

	const types: string[] =
		recipe === 'vitest-react'
			? ['vitest', 'node', ...(isTsx ? ['react', 'react-dom'] : [])]
			: ['jest', 'node', ...(isTsx ? ['react', 'react-dom'] : [])];
	const usesPuppeteer =
		/\bpuppeteer\b/.test(code) ||
		/from\s+['"]puppeteer['"]/.test(code) ||
		/require\(\s*['"]puppeteer['"]\s*\)/.test(code);
	if (usesPuppeteer) {
		types.push('puppeteer');
	}

	const compilerOptions: Record<string, unknown> = {
		noEmit: true,
		skipLibCheck: true,
		esModuleInterop: true,
		allowSyntheticDefaultImports: true,
		moduleResolution: 'node',
		module: 'ESNext',
		target: 'ES2022',
		types,
		isolatedModules: true
	};
	if (isTsx) {
		compilerOptions.jsx = 'react-jsx';
	}

	const ordered: Record<string, unknown> = {};
	if (extendsParentTsconfig) {
		ordered.extends = '../tsconfig.json';
	}
	ordered.compilerOptions = compilerOptions;
	ordered.include = ['./**/*.ts', './**/*.tsx'];

	return `${JSON.stringify(ordered, null, 2)}\n`;
}

function genericBody(relativePath: string): string {
	return [
		'## Generic steps',
		'',
		'This project did not match a specific recipe (Jest/Vitest/pytest/JUnit).',
		'',
		'- Use the **test runner** your repo already uses (`npm test`, `pnpm test`, `pytest`, `mvn test`, etc.).',
		'- If the file contains **JSX**, you need a transpiler (`babel-jest`, `ts-jest`, or Vitest + `@vitejs/plugin-react`). Do **not** use `node path/to/file.jsx` directly.',
		'- If the file uses **`describe` / `it` / `jest`**, run it with **Jest** or **Vitest**, not plain Node.',
		"- **Puppeteer / Playwright E2E:** point URLs at **local config** — load root `.env` with `dotenv` (`npm i -D dotenv`) from `generated-tests/` via `path.resolve(__dirname, '..', '.env')`, then use `process.env.BASE_URL` / `VITE_*` keys from your `.env.example`.",
		'',
		`Target file: \`${relativePath}\``,
		''
	].join('\n');
}

/**
 * Full Markdown written to `generated-tests/HOW_TO_RUN_GENERATED_TESTS.md` and summarized in the webview.
 */
export function buildGeneratedTestRunInstructionsMarkdown(
	detectedStack: string,
	recommendedFramework: string,
	testFilename: string
): string {
	const relativePath = `generated-tests/${testFilename}`;
	const recipe = resolveGeneratedTestRunRecipe(detectedStack, recommendedFramework, testFilename);
	let body: string;
	switch (recipe) {
		case 'pytest':
			body = pytestBody(relativePath);
			break;
		case 'junit':
			body = junitBody(relativePath);
			break;
		case 'vitest-react':
			body = vitestReactBody(relativePath);
			break;
		case 'jest-react':
			body = jestReactBody(relativePath);
			break;
		case 'jest-js':
			body = jestJsBody(relativePath);
			break;
		default:
			body = genericBody(relativePath);
	}
	return (
		header(detectedStack, recommendedFramework, relativePath) +
		body +
		typescriptIdeSection(testFilename, recipe)
	);
}
