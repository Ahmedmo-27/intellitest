/**
 * Drops pre-refactor FeatureRelationship indexes that used { feature, relatedFeature }.
 * Those indexes collide with the current { source, target, type } schema (null dup keys).
 */
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

export async function dropLegacyFeatureRelationshipIndexes() {
  try {
    const coll = mongoose.connection.collection("featurerelationships");
    let indexes;
    try {
      indexes = await coll.indexes();
    } catch (err) {
      if (err.code === 26 || err.codeName === "NamespaceNotFound") return;
      throw err;
    }
    for (const idx of indexes) {
      const key = idx.key || {};
      const name = idx.name;
      if (!name || name === "_id_") continue;
      if ("feature" in key || "relatedFeature" in key) {
        await coll.dropIndex(name);
        logger.info("dropped_legacy_featurerelationship_index", { indexName: name, key });
      }
    }
  } catch (err) {
    logger.warn("legacy_featurerelationship_index_cleanup_failed", { message: err.message });
  }
}
