import { loadPrompt, fillPrompt } from "../utils/promptLoader.js";

function projectContextBlock(map) {
  const lines = [
    "Project context (structured):",
    `- language: ${map.language || "unknown"}`,
    `- framework: ${map.framework || "unknown"}`
  ];

  // 🔥 FIX: We now inject the highly accurate AST Code Insights directly into the prompt.
  // We completely removed the generic "routes" and "modules" arrays because they 
  // bloated the prompt with garbage files.
  if (map.codeInsights) {
    lines.push("\n[Target Project File Context - AST Code Insights]:");
    for (const [file, insights] of Object.entries(map.codeInsights)) {
      lines.push(`- ${file}: ${insights}`);
    }
  }

  return lines.join("\n");
}

export function detectFeaturesPrompt(projectMap) {
  const template = loadPrompt("detectFeatures.txt");

  return fillPrompt(template, {
    CODEBASE_SUMMARY: projectContextBlock(projectMap),
  });
}

function priorityFilesBlock(map) {
  if (!Array.isArray(map.priorityFiles) || map.priorityFiles.length === 0) {
    return "";
  }

  return `\nPRIORITY FILES (focus test cases here first):\nThe tester specifically mentioned these files as focus areas. Generate test cases that exercise their functions, classes, and variables:\n${map.priorityFiles
    .map((f) => `- ${f}`)
    .join("\n")}`;
}

export function generateTestCasesPrompt(projectMap, matchResult, restrictInstruction) {
  const ctx = projectContextBlock(projectMap);
  const priorityCtx = priorityFilesBlock(projectMap);

  const testerAsk =
    projectMap.prompt && String(projectMap.prompt).trim()
      ? `\n\nTester request:\n${String(projectMap.prompt).trim()}\n`
      : "";

  const restrictions = restrictInstruction ? `\n\nCRITICAL SCOPE RESTRICTION:\n${restrictInstruction}\n` : "";

  return `You are a senior QA engineer. ${ctx}${priorityCtx}${testerAsk}${restrictions}

Task: Propose manual test cases that cover critical user flows and edge cases for this system.

Rules:
- Output ONLY valid JSON (no markdown, no commentary).
- Return a JSON array of objects. Each object MUST have: "id", "name", "description", "preconditions", "steps", "expected", "comments".
- Also include "priority": one of "critical", "high", "medium", "low".
- Include "tags": array of short labels.
- Keep "description" as a human-readable scenario summary.
- Keep "preconditions" concrete.
- If priority files were specified, emphasize test cases that exercise those files first.
- Order the array so critical items appear first.

Example shape:
[{"id":"TC-001","name":"...","description":"...","preconditions":"...","steps":["..."],"expected":"...","priority":"critical","tags":["auth"],"comments":"..."}]`;
}

export function generateTestScriptsPrompt(projectMap) {
  const template = loadPrompt("generateTestScripts.txt");

  const lang = (projectMap.language || "").toLowerCase();
  const fw = (projectMap.framework || "").toLowerCase();

  let framework = "jest";
  let language = "javascript";
  let filename = "generated.test.js";

  if (lang.includes("python")) {
    framework = "pytest";
    language = "python";
    filename = "test_generated.py";
  } else if (lang.includes("java") || fw.includes("spring")) {
    framework = "junit";
    language = "java";
    filename = "GeneratedTest.java";
  }

  const testCasesBlock =
    Array.isArray(projectMap.testCases) && projectMap.testCases.length > 0
      ? JSON.stringify(projectMap.testCases, null, 2)
      : "[]";

  const testerAsk =
    projectMap.prompt && String(projectMap.prompt).trim()
      ? String(projectMap.prompt).trim()
      : "No extra tester request provided.";

  return fillPrompt(template, {
    PROJECT_CONTEXT: projectContextBlock(projectMap),
    TEST_CASES: testCasesBlock,
    FRAMEWORK: framework,
    LANGUAGE: language,
    FILENAME: filename,
    TESTER_REQUEST: testerAsk,
  });
}

export function analyzeFailurePrompt(payload) {
  const template = loadPrompt("analyzeFailure.txt");

  return fillPrompt(template, {
    FAILURE_OUTPUT: payload.error ?? "",
    TEST_NAME: payload.test ?? "",
  });
}

/**
 * Executable test code from structured cases. Embeds the full prior-generation JSON
 * (POST /generate response body) so the model stays aligned with the same scenarios.
 *
 * @param {string} frameworkHint
 * @param {Record<string, unknown>} generateResponsePayload
 * @returns {string}
 */
export function generateExecutableTestCodePrompt(frameworkHint, generateResponsePayload, localConfigHints = "") {
  const jsonBlock = JSON.stringify(generateResponsePayload ?? {}, null, 2);
  const fw =
    frameworkHint && String(frameworkHint).trim() && !/not (detected|generated|specified)/i.test(frameworkHint)
      ? String(frameworkHint).trim()
      : "Infer the best matching test runner from the JSON and project hints.";

  const hintsTrim = String(localConfigHints ?? "").trim();
  const hintsBlock =
    hintsTrim.length > 0
      ? `
WORKSPACE_ENV_TEMPLATES (from the developer machine — variable names and patterns to mirror in code; never paste secrets into tests):
${hintsTrim}

`
      : "";

  return `You are a senior QA automation engineer.

The JSON below is the exact structured output from the prior manual test-case generation step (LLM via POST /generate), including its "testCases" array and any metadata fields (meta, features, insights, etc.). Treat this JSON as the single source of truth for what to automate.

PRIOR_GENERATION_JSON:
${jsonBlock}

Target testing framework hint: ${fw}
${hintsBlock}
Task: Generate executable automated test code that implements these scenarios.
Rules:
- Use clear test names, setup, actions, expected results, and assertions.
- Generate clean, complete, runnable code.
- Return only the raw source code — no markdown, no code fences, no explanation before or after the code.
- Do NOT assume the file can be run with plain \`node file.js\`. React / JSX and Jest globals (\`describe\`, \`test\`, \`jest\`, \`expect\`) require a test runner (Jest or Vitest) with JSX transpilation and a DOM environment.
- If the code uses React, JSX, React Testing Library, or DOM APIs, start the file with this exact Jest docblock (before imports):
  /**
   * @jest-environment jsdom
   *
   * Run from the project root with Jest (not Node directly), e.g.:
   *   npx jest generated-tests/this-file.spec.jsx
   * Dependencies (Jest 28+):
   *   npm install -D jest jest-environment-jsdom babel-jest @babel/core @babel/preset-env @babel/preset-react
   * babel.config.cjs must include presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }]]
   * jest.config must include: transform: { '^.+\\.[jt]sx?$': 'babel-jest' }, testEnvironment: 'jsdom'
   * Prefer .jsx/.tsx filenames when this file contains JSX.
   */
- If you use JSX or TSX syntax, the implied filename extension should be .jsx or .tsx respectively (the tooling must compile JSX).
- If you emit **TypeScript** (.ts / .tsx), put \`/// <reference types="jest" />\` as the **first line** of the file (before the Jest docblock is OK). Use proper imports and types for **Puppeteer** (\`import type { Browser, Page } from 'puppeteer'\`) or **Playwright** (\`@playwright/test\`) so \`browser\`, \`page\`, and callbacks are not implicit \`any\`.
- **Local configuration only (URLs, API origins, ports):** Never use placeholder hosts such as \`example.com\` or made-up production URLs. The app runs locally — wire tests to the same env the project uses:
  - For **Node / Jest / Puppeteer / Playwright** tests: load the workspace \`.env\` from the **project root** (tests are saved under \`generated-tests/\`): e.g. \`require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });\` then read \`process.env.YOUR_VAR\`. Mention \`npm install dotenv\` as a devDependency when using this pattern.
  - Prefer variable names that appear in WORKSPACE_ENV_TEMPLATES above when that section is present (e.g. \`VITE_APP_URL\`, \`BASE_URL\`, \`API_URL\`, \`PLAYWRIGHT_BASE_URL\`, \`REACT_APP_*\`). Mirror \`VITE_*\` keys via \`process.env.VITE_...\` in Node after dotenv loads \`.env\`.
  - If an env var is missing, use a **short comment** and a **localhost fallback** consistent with the stack hint (e.g. Vite dev server \`http://localhost:5173\`, Express \`http://localhost:3000\`) — never invent unrelated domains.
  - **Credentials:** never hardcode real passwords; use \`process.env.E2E_USERNAME\`, \`process.env.E2E_PASSWORD\`, etc., and note in comments which vars must be set in \`.env\`.
- For **Vitest + Vite** component tests that read client env at build time, follow the project’s usual \`import.meta.env.VITE_*\` pattern only when the test file runs in Vitest’s Vite context; otherwise use \`process.env\` + dotenv for Node-driven E2E.
- **Jest module resolution (critical):** Generated tests are saved under \`generated-tests/\`. Imports must resolve under Jest **without** extra setup when possible:
  - Prefer **relative** paths from \`generated-tests/\` to source (e.g. \`../client/src/pages/CartPage\`, \`../../client/src/services/cartApi\`) matching folder layout in PRIOR_GENERATION_JSON routes/modules — **do not** default to bare aliases like \`client/src/...\` unless you also output a comment listing the exact \`moduleNameMapper\` entries required in \`jest.config.cjs\`.
  - If you \`jest.mock('axios')\` or \`import axios from 'axios'\`, the project must list **axios** as a dependency (\`npm install axios\`). Prefer mocking the **app module** that wraps HTTP (e.g. \`jest.mock('../client/src/services/cartApi', () => ({ ... }))\`) or use \`jest.spyOn\` on exported functions with \`mockResolvedValue\` / \`mockImplementation\` so tests do not require axios to be installed only for the mock hoisting path when unnecessary.
  - Use only **standard Jest matchers** (\`toEqual\`, \`toStrictEqual\`, \`toContain\`, \`toHaveLength\`, \`resolves\`, etc.). Do **not** use \`toBeEmpty()\` unless \`@testing-library/jest-dom\` is imported and the receiver is a DOM node per that matcher’s contract.
  - When asserting async API helpers (\`fetchServerCart\`, etc.), **mock their implementations** in \`beforeEach\` so expectations are deterministic; do not assume real network or server state.
- Prefer import paths that match a typical monorepo/client layout when the JSON implies one; avoid paths that only work inside this generator’s sandbox.`;
}