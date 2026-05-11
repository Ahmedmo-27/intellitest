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

import * as promptService from "../services/promptService.js";
import * as projectService from "../services/projectService.js";
import * as contextService from "../services/contextService.js";
import * as guardrailService from "../services/guardrailService.js";
import { extractFeatures, buildFeatureRelationships } from "../services/featureExtractionService.js";
import { normalizeFeatureKey } from "../services/featureGraphService.js";
import {
  mapPromptToFeatures,
  domainMatchedFeatures,
  mergeRelationshipLists,
} from "../services/featureMappingEngine.js";
import { calculateCoverage } from "../services/coverageEngine.js";
import * as formatter from "../utils/formatter.js";
import { logTerminalSection, logger } from "../utils/logger.js";
import { complete } from "../ai/aiService.js";
import { sendError } from "../utils/errorHandler.js";
import {
  runValidationPipeline,
  makeQuickValidator,
  TEST_CASES_SCHEMA,
} from "../validators/outputValidator.js";
import { computeFeatureWeightsSafe } from "../utils/safeWeighting.js";

// ── Safe fallback (returned alongside error payloads) ─────────────────────────

const FALLBACK_GENERATE = Object.freeze({
  testCases: [],
  scripts: null,
  insights: [],
  suggestions: [],
  meta: { fallback: true, message: "AI could not produce valid output. Please try again." },
});

/**
 * mapPromptToFeatures() returns `{ decision, features, ... }` but this controller expects
 * `matchType`, `matchedFeatures`, `relatedFeatures`, `confidence` (legacy shape).
 */
function adaptFeatureMappingResult(engineResult) {
  const features = Array.isArray(engineResult?.features) ? engineResult.features : [];
  const matchedFeatures = features.map((f) => f.name).filter(Boolean);

  const relatedFeatures = [];
  const seenRelated = new Set();
  for (const f of features) {
    for (const rel of f.relatedFeatures || []) {
      const name = typeof rel === "string" ? rel : rel?.name;
      if (name && !seenRelated.has(name)) {
        seenRelated.add(name);
        relatedFeatures.push(name);
      }
    }
  }

  let matchType = engineResult?.decision ?? "none";
  if (matchType === "strong") {
    matchType = "allowed";
  }

  return {
    decision: engineResult?.decision ?? "none",
    features,
    warnings: engineResult?.warnings ?? [],
    suggestions: engineResult?.suggestions ?? [],
    matchType,
    matchedFeatures,
    relatedFeatures,
    confidence: features[0]?.confidence ?? 0,
    closestFlows: engineResult?.closestFlows ?? [],
  };
}

// ── Controller ─────────────────────────────────────────────────────────────────

/**
 * POST /generate
 * @type {import("express").RequestHandler}
 */
export async function generate(req, res) {
  const startMs = Date.now();
  const userId = req.userId || req.user?.id; // extracted from authMiddleware
  const projectId = req.projectId;          // set by validateGenerate
  const projectMap = req.projectMap;          // set by validateGenerate
  const userPrompt = projectMap.prompt ?? "";

  logTerminalSection("POST /generate — userId", userId);
  logTerminalSection("POST /generate — projectId", projectId);
  logTerminalSection("POST /generate — projectMap", projectMap);

  // Mutable state scoped to this request — used in both success + error paths
  let rawAiOutput = "";
  let retryCount = 0;
  let aiStatus = "ok";
  let validationErrors = [];

  try {
    // ── Step 1: Upsert project + merge context (parallel) ────────────────────
    let context = null;
    if (userId) {
      const [, ctx] = await Promise.all([
        projectService.upsertProject(userId, projectId, projectMap),
        projectService.mergeContext(userId, projectId, projectMap),
      ]);
      context = ctx;
    }

    // ── Step 2: Enrich projectMap with stored context ─────────────────────────
    const enrichedMap = contextService.enrichProjectMap(projectMap, context);

    // ── Step 2.1: Clean Context ───────────────────────────────────────────────
    const cleanedMap = contextService.cleanContext(enrichedMap);

    // ── Step 2.2: Feature catalog + relationships ─────────────────────────────
    // Prefer MongoDB (after sync or prior generate); else derive from this request's projectMap.
    let extractedFeatures = [];
    if (userId) {
      extractedFeatures = await projectService.loadFeatures(userId, projectId);
    }
    if (extractedFeatures.length === 0) {
      extractedFeatures = extractFeatures(projectMap, null);
    }

    let persistedRelationships = [];
    if (userId) {
      persistedRelationships = await projectService.loadFeatureRelationships(userId, projectId);
    }

    const computedRelationships = buildFeatureRelationships(extractedFeatures, cleanedMap, null);
    const relationships = mergeRelationshipLists(computedRelationships, persistedRelationships);
    const allowedFeatures = extractedFeatures.map(f => f.name || f.normalizedName);

    // Persist graph edges + features so MongoDB is not only filled by POST /project/:projectId/sync
    if (userId && extractedFeatures.length > 0) {
      try {
        await projectService.syncFeatureIntelligence(userId, projectId, extractedFeatures, computedRelationships);
      } catch (syncErr) {
        logger.warn("feature_intelligence_sync_failed", {
          projectId,
          message: syncErr.message,
        });
      }
    }

    // ── Step 2.5: Guardrail Decision Layer (Feature Intelligence) ─────────────
    const matchResult = mapPromptToFeatures(userPrompt, extractedFeatures, relationships);

    let decision = "allowed";
    if (userPrompt.trim().length > 0) {
      decision = matchResult.decision;
    }

    const matchedFeatureNames = matchResult.features.map(f => f.name);

    const expandedAllowed = guardrailService.expandAllowedFeaturesForGuardrail(
      allowedFeatures,
      matchedFeatureNames,
      relationships,
      userPrompt,
    );

    const relatedFeatureNames = matchResult.features.flatMap((f) =>
      (f.relatedFeatures || []).map((r) => r.name),
    );

    const restrictLabels = guardrailService.buildRestrictionFeatureLabels(
      matchedFeatureNames,
      expandedAllowed,
      relatedFeatureNames,
      36,
    );

    const hasCatalog = allowedFeatures.length > 0;
    if (userPrompt.trim().length > 0 && !hasCatalog) {
      decision = "allowed";
    }

    let coverageMap = {};
    if (userId && matchedFeatureNames.length > 0) {
      const coverages = await projectService.loadFeatureCoverage(userId, projectId, matchedFeatureNames);
      for (const c of coverages) {
        coverageMap[c.feature] = c;
      }

    }

    const domainMatches = domainMatchedFeatures(matchedFeatureNames);

    logger.info("feature_mapping", {
      event: "feature_mapping",
      prompt: userPrompt,
      extractedFeatures: allowedFeatures,
      matchedFeatures: matchedFeatureNames,
      domainMatches,
      relatedFeatures: matchResult.features.flatMap(f => f.relatedFeatures.map(r => r.name)),
      coverage: coverageMap,
      confidence: matchResult.confidence,
      decision: decision === "none" ? "fallback" : decision
    });

    const catalogDomainHints = domainMatchedFeatures(allowedFeatures);

    // When we *do* have a catalog but nothing matched the prompt, return a clear message — no LLM, no test cases.
    if (decision === "none" && userPrompt.trim().length > 0 && hasCatalog) {
      return res.json({
        message:
          "No feature in this project matches your prompt. Refine what you want to test, or pick an area that exists in your codebase.",
        warning: "Feature not found",
        suggestions: matchResult.suggestions?.length
          ? matchResult.suggestions
          : catalogDomainHints.slice(0, 10),
        action: "feature_not_found",
        features: [],
        testCases: [],
      });
    }

    // Prompt only hit generic paths (e.g. `tests/`) — not a real domain feature.
    if (
      userPrompt.trim().length > 0 &&
      hasCatalog &&
      matchedFeatureNames.length > 0 &&
      domainMatches.length === 0
    ) {
      return res.json({
        message:
          "Your prompt does not match a concrete feature in this project (only generic folders such as tests matched). Describe a product or API area that appears in your codebase.",
        warning: "No domain feature match",
        suggestions: catalogDomainHints.length ? catalogDomainHints.slice(0, 10) : allowedFeatures.slice(0, 10),
        action: "no_domain_match",
        features: [],
        testCases: [],
      });
    }

    // ── Step 3: Build prompt ──────────────────────────────────────────────────
    let restrictInstruction = "";
    if (decision === "partial") {
      restrictInstruction = `Ignore non-existent features. Focus on these areas (and closely related flows): ${restrictLabels.join(", ")}.`;
    }

    // 🔥 FIX: Create a strict map from the incoming payload so we don't bloat the LLM
    // with historical routes from the enriched/cleaned map.
    const strictMap = contextService.cleanContext(projectMap);

    // Pass matchResult so the prompt enforcement layer can limit scope if needed
    const aiPrompt = promptService.generateTestCasesPrompt(strictMap, matchResult, restrictInstruction);

    // ── Step 4: AI call with tracking validator ───────────────────────────────
    const validator = makeQuickValidator(TEST_CASES_SCHEMA);
    let callCount = 0;
    let aiOutputWarning = null;
    const trackingValidator = (raw) => {
      callCount++;
      if (!validator(raw)) return false;

      // POST-AI Validation: Validate context alignment
      const parsed = formatter.parseTestCasesArray(raw);
      const validationResult = guardrailService.validateAIOutput(parsed, expandedAllowed);

      if (validationResult.decision === "warning") {
        logger.warn("guardrail_hallucination", {
          event: "validation",
          allowedFeatures: expandedAllowed,
          detectedTerms: validationResult.detectedTerms,
          invalidTerms: validationResult.invalidTerms,
          decision: validationResult.decision
        });

        aiOutputWarning = `The AI included unknown domain features: ${validationResult.invalidTerms.join(", ")}`;
        return false; // Force retry. If maxRetries reached, fallback.
      } else {
        aiOutputWarning = null;
      }
      return true;
    };

    rawAiOutput = await complete(aiPrompt, {
      validator: trackingValidator,
      correctionPrompt: `The previous response hallucinated features. STRICTLY limit your tags and test targets to these known features: [${expandedAllowed.join(", ")}].\n\n`,
      maxRetries: 1 // Limit retries to 1
    });
    retryCount = Math.max(0, callCount - 1); // attempt 0 = first call

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
    if (userId) {
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
          prompt: aiPrompt,
          normalizedPrompt: userPrompt,
          projectMap: cleanedMap,
          response: rawAiOutput,
          latencyMs,
          retryCount,
          status: aiStatus,
          isValid: validation.ok,
          validationErrors,
        }),
      ]);
    }

    // ── Step 8: Upsert coverage & returned features ───────────────────────────
    const returnedFeatures = [];
    let weightSummary = null;
    let weightsByName = null;
    if (userId && testCases.length > 0 && matchedFeatureNames.length > 0) {
      const coverageResults = matchedFeatureNames.map((featureName) => {
        const cov = calculateCoverage(featureName, testCases);
        return {
          feature: featureName,
          testCaseCount: testCases.length,
          estimatedCoverage: cov.coverage,
          missingAreas: cov.missingAreas,
        };
      });
      await projectService.upsertFeatureCoverage(userId, projectId, coverageResults);

      const coverageByFeature = {};
      for (const cov of coverageResults) {
        coverageByFeature[cov.feature] = cov.estimatedCoverage;
      }

      const weightResult = computeFeatureWeightsSafe({
        relationships,
        features: extractedFeatures,
        coverageByFeature,
        projectId,
        userId,
        source: "generate",
      });
      if (weightResult) {
        weightsByName = weightResult.weightsByName;
        weightSummary = {
          weightedCoverage: weightResult.weightedCoverage,
          weightSum: weightResult.weightSum,
        };
      }

      for (let i = 0; i < coverageResults.length; i++) {
        const cov = coverageResults[i];
        const featureName = cov.feature;
        const featureObj = extractedFeatures.find((f) => f.normalizedName === featureName);
        const matchFeat = matchResult.features.find((f) => f.name === featureName);
        const weightKey = normalizeFeatureKey(featureName);
        const weightEntry = weightsByName ? weightsByName[weightKey] : null;

        returnedFeatures.push({
          name: featureName,
          files: featureObj ? featureObj.files : [],
          relatedFeatures: matchFeat ? matchFeat.relatedFeatures.map((r) => r.name) : [],
          coverage: cov.estimatedCoverage,
          confidence: matchFeat ? matchFeat.confidence : 0,
          missingTestAreas: cov.missingAreas,
          weight: weightEntry ? weightEntry.weight : null,
        });
      }
    }

    // ── Step 9: Respond ───────────────────────────────────────────────────────
    const responsePayload = {
      testCases,
      scripts: null,
      insights: contextService.insightsToArray(enrichedMap.codeInsights),
      suggestions: [],
      features: returnedFeatures,
      meta: {
        projectId,
        latencyMs,
        retryCount,
        contextVersion: context?.contextVersion ?? 1,
        fallback: aiStatus === "fallback",
        matchConfidence: matchResult.features.length > 0 ? matchResult.features[0].confidence : 0
      },
    };

    if (weightSummary && weightSummary.weightedCoverage != null) {
      responsePayload.meta.weightedCoverage = weightSummary.weightedCoverage;
      responsePayload.meta.weightTotal = weightSummary.weightSum;
      responsePayload.meta.weightingModel = "core-connectivity-v1";
    }

    if (matchResult.matchType === "partial") {
      responsePayload.warning = "Prompt only partially matched the project context. The output has been limited to known features.";
    }

    if (aiOutputWarning) {
      responsePayload.warning = (responsePayload.warning ? responsePayload.warning + " " : "") + aiOutputWarning;
    }

    return res.json(responsePayload);

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    logger.error("generate_failed", { projectId, message: err.message, latencyMs });

    // Best-effort persistence — fire-and-forget; must not mask the original error
    if (userId) {
      projectService
        .saveGeneration({
          userId,
          projectId,
          prompt: aiPrompt_safe(req.projectMap),
          response: rawAiOutput,
          latencyMs,
          retryCount,
          status: "error",
          isValid: false,
          validationErrors: [err.message],
        })
        .catch((dbErr) =>
          logger.error("generation_persist_failed", { message: dbErr.message })
        );
    }

    return sendError(res, err, FALLBACK_GENERATE);
  }
}

/**
 * POST /analyze-intent
 * Fast pre-flight check to determine relevant features and files for a prompt
 */
export async function analyzeIntent(req, res) {
  try {
    const { prompt, projectId, files } = req.body;
    if (!prompt) {
      return res.json({
        decision: "none",
        matchedFeatures: [],
        relatedFeatures: [],
        relevantFiles: [],
        suggestions: [],
        isFlowTest: false,
      });
    }

    const userId = req.userId || req.user?.id;

    // Prefer MongoDB feature graph (same as POST /generate) when the user is signed in.
    let extractedFeatures = [];
    if (userId && projectId) {
      extractedFeatures = await projectService.loadFeatures(userId, projectId);
    }
    if (extractedFeatures.length === 0) {
      const mockMap = { files: files || [] };
      extractedFeatures = extractFeatures(mockMap, null);
    }

    let persistedRelationships = [];
    if (userId && projectId) {
      persistedRelationships = await projectService.loadFeatureRelationships(userId, projectId);
    }
    const relationships = mergeRelationshipLists(
      buildFeatureRelationships(extractedFeatures, { files: files || [] }, null),
      persistedRelationships,
    );
    const matchResult = mapPromptToFeatures(prompt, extractedFeatures, relationships);

    const catalogNames = extractedFeatures.map((f) => f.name || f.normalizedName);
    const matchedFeatureNames = matchResult.features.map((f) => f.name);
    const domainMatches = domainMatchedFeatures(matchedFeatureNames);
    const catalogDomainHints = domainMatchedFeatures(catalogNames);

    // No real domain feature matched — align with /generate (skip expensive mapping).
    if (prompt.trim() && extractedFeatures.length > 0 && domainMatches.length === 0) {
      const hintList = catalogDomainHints.length ? catalogDomainHints : catalogNames;
      return res.json({
        decision: "none",
        matchedFeatures: [],
        relatedFeatures: [],
        relevantFiles: [],
        isFlowTest: false,
        suggestions: hintList.slice(0, 10),
      });
    }

    let suggestions =
      matchResult.suggestions?.length
        ? matchResult.suggestions
        : catalogDomainHints.slice(0, 10);
    if (!suggestions.length) {
      suggestions = catalogNames.slice(0, 10);
    }

    const relevantFilesSet = new Set();

    for (const mf of matchResult.features) {
      if (mf.files) mf.files.forEach((f) => relevantFilesSet.add(f));
    }

    const isFlowTest = /flow|e2e|integration|process|end to end/i.test(prompt);
    const relatedFeatureNames = matchResult.features.flatMap((f) =>
      f.relatedFeatures.map((r) => r.name),
    );

    if (isFlowTest) {
      for (const rf of relatedFeatureNames) {
        const feat = extractedFeatures.find((f) => f.normalizedName === rf);
        if (feat && feat.files) {
          const allFiles = Array.from(feat.files);

          const coreFiles = allFiles.filter(
            (f) =>
              f.toLowerCase().includes(rf) ||
              /service|controller|api|route|index/i.test(f),
          );

          const finalFiles = coreFiles.length > 0 ? coreFiles : allFiles;

          finalFiles.slice(0, 10).forEach((f) => relevantFilesSet.add(f));
        }
      }
    }

    return res.json({
      decision: matchResult.decision,
      matchedFeatures: matchedFeatureNames,
      relatedFeatures: relatedFeatureNames,
      relevantFiles: Array.from(relevantFilesSet),
      isFlowTest,
      suggestions,
    });
  } catch (err) {
    logger.error("analyze_intent_failed", { message: err.message });
    return res.status(500).json({ error: "Failed to analyze intent" });
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
