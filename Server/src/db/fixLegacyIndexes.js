/**
 * Drops indexes incompatible with compact hub storage on `featurerelationships`:
 * - legacy { feature, relatedFeature }
 * - per-edge flat rows { source, target, ... } at collection root
 */
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

function shouldDropFeatureRelationshipIndex(key) {
  if (!key || typeof key !== "object") return false;
  if ("feature" in key || "relatedFeature" in key) return true;
  if ("source" in key || "target" in key) return true;
  if ("hubFeature" in key) return false;
  const keys = Object.keys(key).filter((k) => k !== "_id");
  if (keys.length === 2 && "userId" in key && "projectId" in key) return false;
  if ("confidence" in key) return true;
  if ("type" in key) return true;
  return false;
}

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
      if (shouldDropFeatureRelationshipIndex(key)) {
        await coll.dropIndex(name);
        logger.info("dropped_legacy_featurerelationship_index", { indexName: name, key });
      }
    }
  } catch (err) {
    logger.warn("legacy_featurerelationship_index_cleanup_failed", { message: err.message });
  }
}

/**
 * One-time: copy compact graph docs from retired `featuregraphhubs` into `featurerelationships`
 * when the target collection is empty (same document shape).
 */
export async function migrateFeatureGraphHubsCollection() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const collNames = (await db.listCollections().toArray()).map((c) => c.name);
    if (!collNames.includes("featuregraphhubs")) return;

    const oldColl = db.collection("featuregraphhubs");
    const oldCount = await oldColl.countDocuments();
    if (oldCount === 0) return;

    const newColl = db.collection("featurerelationships");
    const existing = await newColl.estimatedDocumentCount();
    if (existing > 0) {
      logger.info("featuregraphhubs_migration_skipped", {
        reason: "featurerelationships_not_empty",
        existing,
      });
      return;
    }

    const docs = await oldColl.find({}).toArray();
    if (docs.length === 0) return;
    await newColl.insertMany(docs, { ordered: false });
    logger.info("migrated_featuregraphhubs_to_featurerelationships", { count: docs.length });
  } catch (err) {
    logger.warn("featuregraphhubs_migration_failed", { message: err.message });
  }
}
