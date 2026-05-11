import { computeFeatureWeights } from "../services/featureGraphService.js";
import { logger } from "./logger.js";

/**
 * Run feature weighting in a failure-isolated manner.
 * Never throws into request handlers; returns null on failure.
 */
export function computeFeatureWeightsSafe({
  relationships = [],
  features = [],
  coverageByFeature = {},
  projectId,
  userId,
  source = "unknown",
}) {
  try {
    return computeFeatureWeights(relationships, features, coverageByFeature);
  } catch (err) {
    logger.warn("weighting_compute_failed", {
      source,
      projectId,
      hasUserId: Boolean(userId),
      message: err?.message || String(err),
    });
    return null;
  }
}
