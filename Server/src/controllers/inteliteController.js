import * as promptService from "../services/promptService.js";
import * as llmService from "../services/llmService.js";
import * as formatter from "../utils/formatter.js";
import { logTerminalSection, logger } from "../utils/logger.js";

/**
 * POST /generate-testcases
 */
export async function generateTestCases(req, res) {
  try {
    logTerminalSection("Extension → server (raw POST JSON body)", req.body);
    logTerminalSection("Extension → server (normalized project map)", req.projectMap ?? req.body);
    const prompt = promptService.generateTestCasesPrompt(req.projectMap);
    const raw = await llmService.complete(prompt);
    const testCases = formatter.parseTestCasesArray(raw);
    logger.info("generate_testcases_ok", { count: testCases.length });
    return res.json({ testCases });
  } catch (err) {
    logger.error("generate_testcases_failed", { message: err.message });
    return res.status(502).json({
      error: "Failed to generate test cases",
      detail: err.message,
    });
  }
}

/**
 * POST /generate-tests
 */
export async function generateTests(req, res) {
  try {
    logTerminalSection("Extension → server (generate-tests project map)", req.projectMap ?? req.body);
    const prompt = promptService.generateTestScriptsPrompt(req.projectMap);
    const raw = await llmService.complete(prompt);
    const script = formatter.parseTestScript(raw);
    logger.info("generate_tests_ok", { framework: script.framework });
    return res.json({ script });
  } catch (err) {
    logger.error("generate_tests_failed", { message: err.message });
    return res.status(502).json({
      error: "Failed to generate test scripts",
      detail: err.message,
    });
  }
}

/**
 * POST /analyze-failure
 */
export async function analyzeFailure(req, res) {
  try {
    logTerminalSection("Extension → server (analyze-failure payload)", req.failurePayload ?? req.body);
    const prompt = promptService.analyzeFailurePrompt(req.failurePayload);
    const raw = await llmService.complete(prompt);
    const analysis = formatter.parseFailureAnalysis(raw);
    logger.info("analyze_failure_ok");
    return res.json({ analysis });
  } catch (err) {
    logger.error("analyze_failure_failed", { message: err.message });
    return res.status(502).json({
      error: "Failed to analyze failure",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}
