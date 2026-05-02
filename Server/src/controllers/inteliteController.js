/**
 * IntelliTest Controllers
 *
 * Each handler follows the same flow:
 *   1. Log incoming payload (request tracing)
 *   2. Build prompt via promptService
 *   3. Call aiService.complete() — which handles timeout + retry internally
 *   4. Run the output through the validation pipeline
 *   5. Parse / normalise with formatter
 *   6. Return structured JSON
 *
 * Errors are classified as source:"AI" or source:"backend" and always
 * carry a stable { source, type, message } shape.
 */

import * as promptService from "../services/promptService.js";
import * as formatter from "../utils/formatter.js";
import { logTerminalSection, logger } from "../utils/logger.js";
import { complete, buildFallbackResponse } from "../ai/aiService.js";
import {
  runValidationPipeline,
  makeQuickValidator,
  TEST_CASES_SCHEMA,
  TEST_SCRIPT_SCHEMA,
  FAILURE_SCHEMA,
} from "../validators/outputValidator.js";

// ── shared safe fallbacks ─────────────────────────────────────────────────────

const FALLBACK_TEST_CASES = Object.freeze({
  testCases: [],
  meta: { fallback: true, message: "AI could not produce valid test cases. Please try again." },
});

const FALLBACK_SCRIPT = Object.freeze({
  script: {
    framework: "jest",
    language: "javascript",
    filename: "generated.test.js",
    code: "// AI could not produce a valid test script. Please try again.",
  },
  meta: { fallback: true },
});

const FALLBACK_ANALYSIS = Object.freeze({
  analysis: {
    explanation: "AI could not produce a valid failure analysis. Please try again.",
    possibleCauses: [],
    suggestedFixes: [],
  },
  meta: { fallback: true },
});

// ── helpers ────────────────────────────────────────────────────────────────────

/**
 * Determine HTTP status code from an error's source/type.
 * @param {Error & { source?: string; type?: string }} err
 * @returns {number}
 */
function statusFromError(err) {
  if (err.type === "RateLimitExceeded") return 429;
  if (err.source === "AI") return 502;
  if (err.source === "backend" && err.type === "MissingConfig") return 503;
  return 500;
}

/**
 * Emit structured error response.
 * @param {import("express").Response} res
 * @param {Error & { source?: string; type?: string }} err
 * @param {unknown} fallback
 */
function sendError(res, err, fallback) {
  const payload = buildFallbackResponse(err);
  const status = statusFromError(err);

  // In development also surface the raw error detail
  if (process.env.NODE_ENV === "development" && err.message) {
    payload.detail = err.message;
  }

  // Return the safe fallback alongside the error so the extension can still render something
  return res.status(status).json({ ...payload, ...fallback });
}

// ── controllers ────────────────────────────────────────────────────────────────

/**
 * POST /generate-testcases
 */
export async function generateTestCases(req, res) {
  try {
    logTerminalSection("Extension → server (raw POST JSON body)", req.body);
    logTerminalSection("Extension → server (normalized project map)", req.projectMap ?? req.body);

    const prompt = promptService.generateTestCasesPrompt(req.projectMap);
    const raw = await complete(prompt, { validator: makeQuickValidator(TEST_CASES_SCHEMA) });

    // Full validation pipeline
    const validation = runValidationPipeline(raw, TEST_CASES_SCHEMA);
    if (!validation.ok) {
      logger.warn("generate_testcases_validation_failed", { reason: validation.reason });
      // formatter is lenient; attempt parsing anyway
    }

    const testCases = formatter.parseTestCasesArray(raw);
    logger.info("generate_testcases_ok", { count: testCases.length });
    return res.json({ testCases });
  } catch (err) {
    logger.error("generate_testcases_failed", { message: err.message });
    return sendError(res, err, FALLBACK_TEST_CASES);
  }
}

/**
 * POST /generate-tests
 */
export async function generateTests(req, res) {
  try {
    logTerminalSection("Extension → server (generate-tests project map)", req.projectMap ?? req.body);

    const prompt = promptService.generateTestScriptsPrompt(req.projectMap);
    const raw = await complete(prompt, { validator: makeQuickValidator(TEST_SCRIPT_SCHEMA) });

    // Full validation pipeline
    const validation = runValidationPipeline(raw, TEST_SCRIPT_SCHEMA);
    if (!validation.ok) {
      logger.warn("generate_tests_validation_failed", { reason: validation.reason });
    }

    const script = formatter.parseTestScript(raw);
    logger.info("generate_tests_ok", { framework: script.framework });
    return res.json({ script });
  } catch (err) {
    logger.error("generate_tests_failed", { message: err.message });
    return sendError(res, err, FALLBACK_SCRIPT);
  }
}

/**
 * POST /analyze-failure
 */
export async function analyzeFailure(req, res) {
  try {
    logTerminalSection("Extension → server (analyze-failure payload)", req.failurePayload ?? req.body);

    const prompt = promptService.analyzeFailurePrompt(req.failurePayload);
    const raw = await complete(prompt, { validator: makeQuickValidator(FAILURE_SCHEMA) });

    // Full validation pipeline
    const validation = runValidationPipeline(raw, FAILURE_SCHEMA);
    if (!validation.ok) {
      logger.warn("analyze_failure_validation_failed", { reason: validation.reason });
    }

    const analysis = formatter.parseFailureAnalysis(raw);
    logger.info("analyze_failure_ok");
    return res.json({ analysis });
  } catch (err) {
    logger.error("analyze_failure_failed", { message: err.message });
    return sendError(res, err, FALLBACK_ANALYSIS);
  }
}
