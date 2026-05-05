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

export function generateTestCasesPrompt(projectMap) {
  const template = loadPrompt("generateTestCases.txt");

  const testerAsk =
    projectMap.prompt && String(projectMap.prompt).trim()
      ? `Tester request:\n${String(projectMap.prompt).trim()}`
      : "Tester request:\nNo extra tester request provided.";

  return fillPrompt(template, {
    PROJECT_CONTEXT: projectContextBlock(projectMap),
    TESTER_REQUEST: testerAsk,
  });
/**
 * Build a priority context block if priority files are specified.
 */
function priorityFilesBlock(map) {
  if (!Array.isArray(map.priorityFiles) || map.priorityFiles.length === 0) {
    return "";
  }
  return `\nPRIORITY FILES (focus test cases here first):\nThe tester specifically mentioned these files as focus areas. Generate test cases that exercise their functions, classes, and variables:\n${map.priorityFiles.map(f => `- ${f}`).join("\n")}`;
}

/**
 * High-level manual test cases with optional priority and tags (bonus).
 */
export function generateTestCasesPrompt(projectMap, matchResult = null, restrictInstruction = "") {
  const ctx = projectContextBlock(projectMap);
  const priorityCtx = priorityFilesBlock(projectMap);
  
  // AST Integration: Add code insights to the prompt
  let astCtx = "";
  if (projectMap.codeInsights) {
    astCtx = `\nCODE INSIGHTS (AST Data):\n`;
    if (projectMap.codeInsights.functions && projectMap.codeInsights.functions.length > 0) {
      astCtx += `- Functions: ${JSON.stringify(projectMap.codeInsights.functions.slice(0, 50))}\n`;
    }
    if (projectMap.codeInsights.variables && projectMap.codeInsights.variables.length > 0) {
      astCtx += `- Variables: ${JSON.stringify(projectMap.codeInsights.variables.slice(0, 50))}\n`;
    }
    if (projectMap.codeInsights.classes && projectMap.codeInsights.classes.length > 0) {
      astCtx += `- Classes: ${JSON.stringify(projectMap.codeInsights.classes.slice(0, 50))}\n`;
    }
  }

  // Prompt Enforcement Layer
  let enforcementCtx = "";
  if (matchResult && matchResult.matchType === "partial") {
    enforcementCtx = `\nWARNING: The tester's request only partially matched the codebase. You MAY infer behavior from routes and modules, but DO NOT invent unrelated systems. If functions are missing, use file-level understanding.\n${restrictInstruction}\n`;
  } else {
    enforcementCtx = `\nSTRICT REQUIREMENT: Use project context as your primary source. You MAY infer behavior from routes and modules, but DO NOT invent unrelated systems. If functions are missing, use file-level understanding.\n`;
  }

  const testerAsk =
    projectMap.prompt && String(projectMap.prompt).trim()
      ? `\n\nTester request (highest priority — honor explicit scope limits; otherwise broaden sensibly):\n${String(projectMap.prompt).trim()}\n`
      : "";
  return `You are a senior QA engineer. ${ctx}${astCtx}${priorityCtx}${testerAsk}${enforcementCtx}

Task: Propose manual test cases that cover critical user flows and edge cases for this system.

Rules:
- Output ONLY valid JSON (no markdown, no commentary).
- Return a JSON array of objects. Each object MUST have: "id" (e.g. TC-001), "name", "description" (string), "preconditions" (string), "steps" (array of strings), "expected" (string), "comments" (string).
- Also include "priority" for each: one of "critical", "high", "medium", "low" (critical = main revenue/auth/safety flows).
- Include "tags": array of short labels drawn from modules/routes/context (e.g. "auth", "cart", "checkout").
- Keep "description" as a human-readable scenario summary. Do NOT put tags inside description.
- Keep "preconditions" concrete (e.g. account exists, user is logged out, product in stock).
- **COMMENTS ENRICHMENT**: The "comments" field MUST include references to real variables/functions, edge case suggestions, and debugging hints based on the CODE INSIGHTS.
- If priority files were specified, emphasize test cases that exercise those files' functions and classes first. Then add broader coverage.
- **IMPORTANT**: Use function signatures and descriptions in the code context:
  - Function signature shows inputs (parameter types) and outputs (return type), e.g., \`validatePassword(password: string, minLength: number): boolean\` means it takes two inputs and returns true/false.
  - If a function has a description, use it to understand the intended behavior and generate tests that verify that behavior.
  - Test "happy path" (valid inputs, expected output) and "edge cases" (invalid inputs, boundary conditions, errors).
- Order the array so critical items appear first.

Example shape (structure only):
[{"id":"TC-001","name":"...","description":"...","preconditions":"...","steps":["..."],"expected":"...","comments":"...","priority":"critical","tags":["auth"]}]`;
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
}