/**
 * Dump + analyze the FeatureRelationship hub collection (MongoDB).
 *
 * Usage (from Server/):
 *   node --env-file=.env scripts/analyze-featurerelationships.mjs
 *   node --env-file=.env scripts/analyze-featurerelationships.mjs --json out/fr.json
 *
 * Requires MONGODB_URI (see .env).
 */

import "dotenv/config";
import mongoose from "mongoose";
import { db as dbConfig } from "../src/config.js";
import { FeatureRelationship } from "../src/models/FeatureRelationship.js";
import { flattenHubsToEdges } from "../src/services/featureGraphHubService.js";

function bucketConfidence(c) {
  if (typeof c !== "number" || Number.isNaN(c)) return "unset_or_nan";
  if (c >= 0.85) return "high (≥0.85)";
  if (c >= 0.6) return "medium (0.6–0.84)";
  if (c >= 0.4) return "low (0.4–0.59)";
  return "very_low (<0.4)";
}

function tally(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function mapToSortedObject(m) {
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
}

async function main() {
  const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;

  await mongoose.connect(dbConfig.uri, {
    serverSelectionTimeoutMS: dbConfig.serverSelectionTimeout,
    socketTimeoutMS: dbConfig.socketTimeout,
  });

  const hubCount = await FeatureRelationship.countDocuments();
  const hubs = await FeatureRelationship.find({}).sort({ projectId: 1, hubFeature: 1 }).lean();
  const docs = flattenHubsToEdges(hubs);
  const total = docs.length;

  const byType = new Map();
  const byProject = new Map();
  const byUser = new Map();
  const byConfidenceBucket = new Map();
  let emptyEvidence = 0;
  let emptyFiles = 0;

  for (const d of docs) {
    tally(byType, d.type || "(missing_type)");
    tally(byProject, d.projectId || "(no_project)");
    tally(byUser, String(d.userId ?? "(no_user)"));
    tally(byConfidenceBucket, bucketConfidence(d.confidence));
    if (!Array.isArray(d.evidence) || d.evidence.length === 0) emptyEvidence++;
    if (!Array.isArray(d.files) || d.files.length === 0) emptyFiles++;
  }

  const edgeKey = (d) => `${d.source}|${d.type}|${d.target}|${d.projectId}`;
  const seen = new Map();
  const duplicates = [];
  for (const d of docs) {
    const k = edgeKey(d);
    if (seen.has(k)) duplicates.push({ key: k, ids: [seen.get(k), d._id] });
    else seen.set(k, d._id);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    storageMode: "FeatureRelationship (compact hubs)",
    hubDocuments: hubCount,
    expandedEdgeCount: total,
    collection: FeatureRelationship.collection.name,
    aggregates: {
      byRelationType: mapToSortedObject(byType),
      byProjectId: mapToSortedObject(byProject),
      byUserId: mapToSortedObject(byUser),
      byConfidenceBucket: mapToSortedObject(byConfidenceBucket),
    },
    quality: {
      edgesWithEmptyEvidence: emptyEvidence,
      edgesWithEmptyFiles: emptyFiles,
      duplicateLogicalEdgesDetected: duplicates.length,
    },
    hubSamples: hubs.slice(0, 5),
    documents: docs.map((d) => ({
      _id: d._hubId ? `${String(d._hubId)}:${d.source}|${d.type}|${d.target}` : String(d._id),
      userId: d.userId ? String(d.userId) : null,
      projectId: d.projectId,
      source: d.source,
      target: d.target,
      type: d.type,
      confidence: typeof d.confidence === "number" ? d.confidence : null,
      evidence: d.evidence ?? [],
      files: d.files ?? [],
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  };

  console.log("=== Feature graph analysis ===\n");
  console.log(`Mode: ${report.storageMode}`);
  console.log(`Hub documents: ${hubCount} | Expanded edges: ${total}`);
  console.log(`Collection: ${report.collection}\n`);

  console.log("--- By relation type ---");
  console.log(JSON.stringify(report.aggregates.byRelationType, null, 2));
  console.log("\n--- By projectId (top buckets) ---");
  const projEntries = Object.entries(report.aggregates.byProjectId);
  console.log(JSON.stringify(Object.fromEntries(projEntries.slice(0, 20)), null, 2));
  if (projEntries.length > 20) console.log(`... (${projEntries.length - 20} more projectIds)\n`);

  console.log("\n--- By confidence bucket ---");
  console.log(JSON.stringify(report.aggregates.byConfidenceBucket, null, 2));

  console.log("\n--- Quality ---");
  console.log(`Edges with empty evidence[]: ${emptyEvidence} (${total ? ((emptyEvidence / total) * 100).toFixed(1) : 0}%)`);
  console.log(`Edges with empty files[]: ${emptyFiles} (${total ? ((emptyFiles / total) * 100).toFixed(1) : 0}%)`);
  console.log(`Duplicate logical edges (same source|type|target|projectId): ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log("Sample duplicates:", JSON.stringify(duplicates.slice(0, 5), null, 2));
  }

  console.log("\n--- Analysis (interpretation) ---");
  if (total === 0) {
    console.log("- No rows yet. Run POST /project/:id/sync or POST /generate with auth to populate.");
  } else {
    const types = report.aggregates.byRelationType;
    const dom = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    console.log(`- Dominant edge type: "${dom?.[0]}" (${dom?.[1]} edges).`);
    if (emptyEvidence / total > 0.7) {
      console.log("- Most edges lack `evidence`: relationship detector may not be recording why edges exist.");
    }
    if (duplicates.length > 0) {
      console.log("- Duplicates suggest repeated sync without clearing project scope; check unique index userId+projectId+hubFeature.");
    }
    const lowShare =
      (report.aggregates.byConfidenceBucket["low (0.4–0.59)"] || 0) +
      (report.aggregates.byConfidenceBucket["very_low (<0.4)"] || 0);
    if (total && lowShare / total > 0.5) {
      console.log("- Many low-confidence edges: consider raising MIN_CONFIDENCE in detection or pruning weak ties.");
    }
  }

  if (jsonOut) {
    const fs = await import("fs/promises");
    await fs.writeFile(jsonOut, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nWrote full JSON (${report.documents.length} docs) to ${jsonOut}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
