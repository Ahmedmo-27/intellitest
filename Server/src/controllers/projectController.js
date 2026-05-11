/**
 * Project Controller — stateful endpoints used by the extension on load.
 *
 * GET /project/:projectId/init
 *   Returns everything the extension needs to bootstrap a session:
 *   - Last N messages (chat history)
 *   - Current project context
 *   - Feature list with test scores
 */

import {
  loadMessages,
  loadContext,
  loadFeatures,
  loadFeatureRelationships,
  loadFeatureCoverage,
  listProjectsForUser,
  syncFeatureIntelligence,
} from "../services/projectService.js";
import { extractFeatures, buildFeatureRelationships } from "../services/featureExtractionService.js";
import {
  analyzeFeatureImpact as analyzeFeatureImpactGraph,
  computeFeatureWeights,
} from "../services/featureGraphService.js";
import { logger } from "../utils/logger.js";

/**
 * GET /project/:projectId/init
 *
 * Called by the extension immediately after it generates / resolves a projectId.
 * The extension uses the response to restore previous session state.
 */
export async function initProject(req, res) {
  const { projectId } = req.params;

  if (!projectId || typeof projectId !== "string" || projectId.trim() === "") {
    return res.status(400).json({
      source: "backend",
      type: "ValidationError",
      message: "projectId param is required.",
    });
  }

  try {
    const userId = req.userId || req.user?.id;

    const [messages, context, features] = await Promise.all([
      loadMessages(userId, projectId, 50),
      loadContext(userId, projectId),
      loadFeatures(userId, projectId),
    ]);

    logger.info("project_init", {
      projectId,
      messageCount: messages.length,
      hasContext: !!context,
      featureCount: features.length,
    });

    return res.json({
      projectId,
      messages,
      context: context ?? null,
      features,
    });
  } catch (err) {
    logger.error("project_init_failed", { projectId, message: err.message });
    return res.status(500).json({
      source: "backend",
      type: "InternalError",
      message: "Failed to load project session.",
    });
  }
}

/**
 * GET /projects
 * Lists projects owned by the authenticated user.
 */
export async function listProjects(req, res) {
  const userId = req.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({
      source: "auth",
      type: "Unauthorized",
      message: "Authentication required.",
    });
  }

  try {
    const projects = await listProjectsForUser(userId, 50);
    return res.json({ projects });
  } catch (err) {
    logger.error("project_list_failed", { message: err.message });
    return res.status(500).json({
      source: "backend",
      type: "InternalError",
      message: "Failed to load projects.",
    });
  }
}

/**
 * POST /project/:projectId/sync
 *
 * Called by the extension when it first loads (or on manual reset) to
 * send the entire project's file list. This builds the global
 * Feature Intelligence Graph in MongoDB once.
 */
export async function syncProject(req, res) {
  const { projectId } = req.params;
  const { files } = req.body;

  if (!projectId || !files || !Array.isArray(files)) {
    return res.status(400).json({ error: "projectId and files array are required." });
  }

  try {
    const userId = req.userId || req.user?.id;
    
    // We already have logger imported at the top, let's just use it, or import logTerminalSection dynamically.
    const { logTerminalSection } = await import("../utils/logger.js");
    logTerminalSection("POST /project/:projectId/sync — FULL PROJECT MAP", `Received ${files.length} files from VS Code.`);

    // Extract features from the entire project file list
    const mockMap = { files };
    const extractedFeatures = extractFeatures(mockMap, null);
    const relationships = buildFeatureRelationships(extractedFeatures, mockMap, null);

    if (userId) {
      await syncFeatureIntelligence(userId, projectId, extractedFeatures, relationships);
    }

    return res.json({ 
      success: true, 
      featureCount: extractedFeatures.length,
      relationshipCount: relationships.length
    });
  } catch (err) {
    logger.error("project_sync_failed", { projectId, message: err.message });
    return res.status(500).json({ error: "Failed to sync project features." });
  }
}

/**
 * GET /project/:projectId/relationships
 * Returns stored relationships + computed weights for visualization.
 */
export async function getProjectRelationships(req, res) {
  const { projectId } = req.params;

  if (!projectId || typeof projectId !== "string" || projectId.trim() === "") {
    return res.status(400).json({
      source: "backend",
      type: "ValidationError",
      message: "projectId param is required.",
    });
  }

  const userId = req.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({
      source: "auth",
      type: "Unauthorized",
      message: "Authentication required.",
    });
  }

  try {
    const [relRows, features] = await Promise.all([
      loadFeatureRelationships(userId, projectId),
      loadFeatures(userId, projectId),
    ]);

    const coverageRows = await loadFeatureCoverage(
      userId,
      projectId,
      (features || []).map((f) => f.normalizedName || f.name),
    );

    const coverageByFeature = {};
    for (const row of coverageRows || []) {
      const value =
        typeof row.estimatedCoverage === "number"
          ? row.estimatedCoverage
          : typeof row.coverage === "number"
            ? row.coverage
            : null;
      if (value != null) coverageByFeature[row.feature] = value;
    }

    const weights = computeFeatureWeights(relRows, features, coverageByFeature);

    return res.json({
      projectId,
      relationships: relRows,
      weights: weights.weightsByName,
      coreFeatures: weights.ranking.slice(0, 12).map((x) => x.name),
      weightedCoverage: weights.weightedCoverage,
      weightingModel: "core-connectivity-v1",
    });
  } catch (err) {
    logger.error("project_relationships_failed", { projectId, message: err.message });
    return res.status(500).json({
      source: "backend",
      type: "InternalError",
      message: "Failed to load feature relationships.",
    });
  }
}

/**
 * POST /project/:projectId/feature-impact
 *
 * Body: { "feature": "<name>" } or { "featureName": "<name>" }
 * Returns dependency-aware impact summary using the stored feature graph.
 */
export async function analyzeFeatureImpact(req, res) {
  const { projectId } = req.params;
  const raw =
    typeof req.body?.feature === "string"
      ? req.body.feature
      : typeof req.body?.featureName === "string"
        ? req.body.featureName
        : "";

  if (!projectId || typeof projectId !== "string" || projectId.trim() === "") {
    return res.status(400).json({
      source: "backend",
      type: "ValidationError",
      message: "projectId param is required.",
    });
  }

  const featureName = raw.trim();
  if (!featureName) {
    return res.status(400).json({
      source: "backend",
      type: "ValidationError",
      message: 'Request body must include a non-empty "feature" or "featureName" string.',
    });
  }

  try {
    const userId = req.userId || req.user?.id;
    const [relRows, features] = await Promise.all([
      loadFeatureRelationships(userId, projectId),
      loadFeatures(userId, projectId),
    ]);

    const relationships = (relRows || []).map((r) => ({
      source: r.source,
      target: r.target,
      type: r.type,
      confidence: r.confidence,
    }));

    const featuresByName = {};
    for (const f of features || []) {
      if (f.normalizedName) {
        featuresByName[f.normalizedName] = {
          importanceScore:
            typeof f.importanceScore === "number" ? f.importanceScore : 0.5,
        };
      }
    }

    const result = analyzeFeatureImpactGraph(featureName, relationships, featuresByName);
    return res.json(result);
  } catch (err) {
    logger.error("feature_impact_failed", { projectId, message: err.message });
    return res.status(500).json({
      source: "backend",
      type: "InternalError",
      message: "Failed to analyze feature impact.",
    });
  }
}
