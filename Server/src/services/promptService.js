/**
 * Reusable prompt templates — structured context only (project map fields), no raw source code.
 * Each prompt asks for a single JSON payload the formatter can parse.
 */

function projectContextBlock(map) {
  return [
    "Project context (structured):",
    `- type (web domain / product category, e.g. e-commerce, LMS): ${map.type}`,
    `- language: ${map.language}`,
    `- framework: ${map.framework}`,
    `- modules: ${JSON.stringify(map.modules ?? [])}`,
    `- routes: ${JSON.stringify(map.routes ?? [])}`,
  ].join("\n");
}

/**
 * High-level manual test cases with optional priority and tags (bonus).
 */
export function generateTestCasesPrompt(projectMap) {
  const ctx = projectContextBlock(projectMap);
  const testerAsk =
    projectMap.prompt && String(projectMap.prompt).trim()
      ? `\n\nTester request (highest priority — honor explicit scope limits; otherwise broaden sensibly):\n${String(projectMap.prompt).trim()}\n`
      : "";
  return `You are a senior QA engineer. ${ctx}${testerAsk}

Task: Propose manual test cases that cover critical user flows and edge cases for this system.

Rules:
- Output ONLY valid JSON (no markdown, no commentary).
- Return a JSON array of objects. Each object MUST have: "id" (e.g. TC-001), "name", "steps" (array of strings), "expected" (string).
- Also include "priority" for each: one of "critical", "high", "medium", "low" (critical = main revenue/auth/safety flows).
- Include "tags": array of short labels drawn from modules/routes/context (e.g. "auth", "cart", "checkout").
- Order the array so critical items appear first.

Example shape (structure only):
[{"id":"TC-001","name":"...","steps":["..."],"expected":"...","priority":"critical","tags":["auth"]}]`;
}

/**
 * Executable test scripts for Jest, Pytest, or JUnit based on language/framework hints.
 */
export function generateTestScriptsPrompt(projectMap) {
  const lang = (projectMap.language || "").toLowerCase();
  const fw = (projectMap.framework || "").toLowerCase();

  let framework = "jest";
  let language = "javascript";
  if (lang.includes("python")) {
    framework = "pytest";
    language = "python";
  } else if (lang.includes("java") || fw.includes("spring")) {
    framework = "junit";
    language = "java";
  }

  const ctx = projectContextBlock(projectMap);
  const tc =
    Array.isArray(projectMap.testCases) && projectMap.testCases.length > 0
      ? `\n\nManual test cases to cover with automation (implement or sketch tests aligned to these):\n${JSON.stringify(projectMap.testCases)}\n`
      : "";
  const testerAsk =
    projectMap.prompt && String(projectMap.prompt).trim()
      ? `\n\nOriginal tester intent:\n${String(projectMap.prompt).trim()}\n`
      : "";
  return `You are a senior test automation engineer. ${ctx}${testerAsk}${tc}

Task: Generate a plausible automated test file skeleton (not full app code) that reflects modules and routes as test targets. Use mocks/stubs where APIs are unknown.

Rules:
- Output ONLY valid JSON (no markdown fences like \`\`\`, no commentary before or after the JSON).
- Single object with keys: "framework" (must be "${framework}"), "language" (must be "${language}"), "filename" (appropriate extension, e.g. login.test.js).
- Put the full file in "codeLines": a JSON array of strings where EACH ELEMENT IS ONE LINE of the file (index 0 = first line). This avoids broken JSON from multiline strings.
- Do NOT use a separate "code" field unless you also provide "codeLines"; prefer "codeLines" only.
- Framework/language/filename must be consistent (e.g. Jest + javascript + .test.js, not junit + javascript).

The file should be runnable in spirit: imports, describe/test blocks, and TODO comments where endpoints need real URLs.`;
}

/**
 * Root-cause style hints from failure message + test name.
 */
export function analyzeFailurePrompt(payload) {
  const err = payload.error ?? "";
  const testName = payload.test ?? "";
  return `You are a senior engineer helping debug a failing test.

Failure message: ${err}
Test name / context: ${testName}

Task: Explain briefly what likely went wrong.

Rules:
- Output ONLY valid JSON (no markdown, no commentary).
- Object keys: "explanation" (simple plain-language string), "possibleCauses" (array of short strings), "suggestedFixes" (array of actionable strings).`;
}
