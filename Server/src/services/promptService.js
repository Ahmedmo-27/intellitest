import { loadPrompt, fillPrompt } from "../utils/promptLoader.js";

function projectContextBlock(map) {
  return [
    "Project context (structured):",
    `- type (web domain / product category, e.g. e-commerce, LMS): ${map.type || "unknown"}`,
    `- language: ${map.language || "unknown"}`,
    `- framework: ${map.framework || "unknown"}`,
    `- modules: ${JSON.stringify(map.modules ?? [])}`,
    `- routes: ${JSON.stringify(map.routes ?? [])}`,
  ].join("\n");
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

export function generateTestCasesPrompt(projectMap) {
  const ctx = projectContextBlock(projectMap);
  const priorityCtx = priorityFilesBlock(projectMap);

  const testerAsk =
    projectMap.prompt && String(projectMap.prompt).trim()
      ? `\n\nTester request (highest priority — honor explicit scope limits; otherwise broaden sensibly):\n${String(
          projectMap.prompt
        ).trim()}\n`
      : "";

  return `You are a senior QA engineer. ${ctx}${priorityCtx}${testerAsk}

Task: Propose manual test cases that cover critical user flows and edge cases for this system.

Rules:
- Output ONLY valid JSON (no markdown, no commentary).
- Return a JSON array of objects. Each object MUST have: "id", "name", "description", "preconditions", "steps", "expected".
- Also include "priority": one of "critical", "high", "medium", "low".
- Include "tags": array of short labels.
- Keep "description" as a human-readable scenario summary.
- Keep "preconditions" concrete.
- If priority files were specified, emphasize test cases that exercise those files first.
- Order the array so critical items appear first.

Example shape:
[{"id":"TC-001","name":"...","description":"...","preconditions":"...","steps":["..."],"expected":"...","priority":"critical","tags":["auth"]}]`;
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