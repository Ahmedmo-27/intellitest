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