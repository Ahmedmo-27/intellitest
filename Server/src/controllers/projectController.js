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
} from "../services/projectService.js";
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
 * POST /project/:projectId/sync
 * 
 * Called by the extension when it first loads (or on manual reset) to 
 * send the entire project's file list. This builds the global 
 * Feature Intelligence Graph in MongoDB once.
 */
import { extractFeatures, buildFeatureRelationships } from "../services/featureExtractionService.js";
import { syncFeatureIntelligence } from "../services/projectService.js";

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
    const relationships = buildFeatureRelationships(extractedFeatures, null);

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
