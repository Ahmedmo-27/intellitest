/**
 * Generate Controller — POST /generate
 *
 * Responsibility: orchestrate the generation flow.
 * All business logic lives in dedicated services.
 *
 * Flow:
 *   1. Upsert project + merge context (parallel DB writes)
 *   2. Enrich projectMap with accumulated context
 *   3. Build AI prompt
 *   4. Call AI with timeout + retry
 *   5. Validate response (4-step pipeline)
 *   6. Parse output
 *   7. Persist message + generation record (parallel)
 *   8. Upsert features
 *   9. Return structured response
 */

import * as promptService  from "../services/promptService.js";
import * as projectService from "../services/projectService.js";
import * as contextService from "../services/contextService.js";
import * as guardrailService from "../services/guardrailService.js";
import * as formatter      from "../utils/formatter.js";
import { logTerminalSection, logger } from "../utils/logger.js";
import { complete }        from "../ai/aiService.js";
import { sendError }       from "../utils/errorHandler.js";
import {
  runValidationPipeline,
  makeQuickValidator,
  TEST_CASES_SCHEMA,
} from "../validators/outputValidator.js";

// ── Safe fallback (returned alongside error payloads) ─────────────────────────

const FALLBACK_GENERATE = Object.freeze({
  testCases:   [],
  scripts:     null,
  insights:    [],
  suggestions: [],
  meta: { fallback: true, message: "AI could not produce valid output. Please try again." },
});

// ── Controller ─────────────────────────────────────────────────────────────────

/**
 * POST /generate
 * @type {import("express").RequestHandler}
 */
export async function generate(req, res) {
  const startMs    = Date.now();
  const userId     = req.userId || req.user?.id; // extracted from authMiddleware
  const projectId  = req.projectId;          // set by validateGenerate
  const projectMap = req.projectMap;          // set by validateGenerate
  const userPrompt = projectMap.prompt ?? "";

  logTerminalSection("POST /generate — userId", userId);
  logTerminalSection("POST /generate — projectId", projectId);
  logTerminalSection("POST /generate — projectMap", projectMap);

  // Mutable state scoped to this request — used in both success + error paths
  let rawAiOutput      = "";
  let retryCount       = 0;
  let aiStatus         = "ok";
  let validationErrors = [];

  try {
    // ── Step 1: Upsert project + merge context (parallel) ────────────────────
    const [, context] = await Promise.all([
      projectService.upsertProject(userId, projectId, projectMap),
      projectService.mergeContext(userId, projectId, projectMap),
    ]);

    // ── Step 2: Enrich projectMap with stored context ─────────────────────────
    const enrichedMap = contextService.enrichProjectMap(projectMap, context);

    // ── Step 2.5: Guardrail Decision Layer ────────────────────────────────────
    const matchResult = guardrailService.matchPromptToContext(userPrompt, enrichedMap);

    if (matchResult.matchType === "none" && userPrompt.trim().length > 0) {
      // ❌ NO MATCH
      logger.warn("guardrail_rejected", { projectId, prompt: userPrompt });
      return res.status(400).json({
        error: "Feature not found in project",
        warning: "Feature not found in project",
        suggestions: ["Check your spelling", "Ensure the feature exists in the codebase"],
        detectedFeatures: [],
        meta: { fallback: true }
      });
    }

    // ── Step 3: Build prompt ──────────────────────────────────────────────────
    // Pass matchResult so the prompt enforcement layer can limit scope if needed
    const aiPrompt = promptService.generateTestCasesPrompt(enrichedMap, matchResult);

    // ── Step 4: AI call with tracking validator ───────────────────────────────
    const validator = makeQuickValidator(TEST_CASES_SCHEMA);
    let callCount   = 0;
    const trackingValidator = (raw) => { 
      callCount++; 
      if (!validator(raw)) return false;
      
      // POST-AI Validation: Validate context alignment
      const parsed = formatter.parseTestCasesArray(raw);
      const validationResult = guardrailService.validateResponseAgainstContext(parsed, enrichedMap);
      if (!validationResult.isValid) {
         logger.warn("guardrail_hallucination", { unknown: validationResult.unknownFeatures });
         // Return false to trigger retry with correction prompt
         return false;
      }
      return true;
    };

    rawAiOutput = await complete(aiPrompt, { 
      validator: trackingValidator,
      correctionPrompt: "The previous response hallucinated features not present in the codebase. STRICTLY limit your tags and test targets to the provided modules, routes, and functions.\n\n"
    });
    retryCount  = Math.max(0, callCount - 1); // attempt 0 = first call

    // ── Step 5: Full validation pipeline ─────────────────────────────────────
    const validation = runValidationPipeline(rawAiOutput, TEST_CASES_SCHEMA);
    if (!validation.ok) {
      logger.warn("generate_validation_failed", { projectId, reason: validation.reason });
      validationErrors = [validation.reason];
      aiStatus = "fallback";
    }

    // ── Step 6: Parse ─────────────────────────────────────────────────────────
    const testCases = formatter.parseTestCasesArray(rawAiOutput);
    logger.info("generate_ok", { projectId, testCaseCount: testCases.length });

    const latencyMs = Date.now() - startMs;

    // ── Step 7: Persist message + generation (parallel) ───────────────────────
    await Promise.all([
      projectService.saveMessage(
        userId,
        projectId,
        userPrompt || aiPrompt.slice(0, 200),
        JSON.stringify({ testCases })
      ),
      projectService.saveGeneration({
        userId,
        projectId,
        prompt:           aiPrompt,
        normalizedPrompt: userPrompt,
        projectMap:       enrichedMap,
        response:         rawAiOutput,
        latencyMs,
        retryCount,
        status:           aiStatus,
        isValid:          validation.ok,
        validationErrors,
      }),
    ]);

    // ── Step 8: Upsert features ───────────────────────────────────────────────
    const features = contextService.extractFeatures(testCases);
    await projectService.upsertFeatures(userId, projectId, features);

    // ── Step 9: Respond ───────────────────────────────────────────────────────
    const responsePayload = {
      testCases,
      scripts:     null,
      insights:    contextService.insightsToArray(enrichedMap.codeInsights),
      suggestions: [],
      meta: {
        projectId,
        latencyMs,
        retryCount,
        contextVersion: context?.contextVersion ?? 1,
        fallback:       aiStatus === "fallback",
        matchConfidence: matchResult.confidence
      },
    };

    if (matchResult.matchType === "partial") {
      responsePayload.warning = "Prompt only partially matched the project context. The output has been limited to known features.";
    }

    return res.json(responsePayload);

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    logger.error("generate_failed", { projectId, message: err.message, latencyMs });

    // Best-effort persistence — fire-and-forget; must not mask the original error
    projectService
      .saveGeneration({
        userId,
        projectId,
        prompt:           aiPrompt_safe(req.projectMap),
        response:         rawAiOutput,
        latencyMs,
        retryCount,
        status:           "error",
        isValid:          false,
        validationErrors: [err.message],
      })
      .catch((dbErr) =>
        logger.error("generation_persist_failed", { message: dbErr.message })
      );

    return sendError(res, err, FALLBACK_GENERATE);
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Build a safe fallback prompt label for error-path persistence.
 * Avoids re-running the full promptService in the catch block.
 */
function aiPrompt_safe(projectMap) {
  if (!projectMap) return "(unknown — request map unavailable)";
  return `[error-path] type=${projectMap.type} lang=${projectMap.language}`;
}
