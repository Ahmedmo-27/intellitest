import {
  normalizeSegment,
  derivePrimaryStem,
  phraseToTokens,
  mergeSynonymAliases,
  NOISE_WORDS,
} from "./featureNormalization.js";
import { detectFeatureRelationships } from "./relationshipDetectionEngine.js";

const featureCache = new Map();
const relationshipCache = new Map();

function detectType(filePath) {
  const lowerPath = filePath.toLowerCase().replace(/\\/g, "/");
  if (
    /\/pages\/|\/screens\/|\.page\.|(^|\/)page\.|\/components\/|\/widgets\/|\/layouts\/|\/views\/|screen\.|modal\./.test(
      lowerPath,
    )
  ) {
    return "ui";
  }
  if (/controller|handlers?\//.test(lowerPath)) return "backend";
  if (/service\.|\/services\/|repository|repos?\//.test(lowerPath)) return "service";
  if (/route|router|\.routes?\./.test(lowerPath)) return "api";
  return "backend";
}

function mergeTypePreference(existing, incoming) {
  const rank = { ui: 4, api: 3, backend: 2, service: 1 };
  const e = existing || "backend";
  return rank[incoming] > rank[e] ? incoming : e;
}

function isLowValueFeature(normalizedName, frequency, fileCount) {
  if (!normalizedName || normalizedName.length < 3) return true;
  const tokens = normalizedName.split(/\s+/);
  if (frequency <= 1 && fileCount <= 1 && tokens.length === 1 && tokens[0].length <= 4) {
    return true;
  }
  return false;
}

/**
 * @param {object} projectMap
 * @param {string|null} projectId — cache key; pass null to bypass
 */
export function extractFeatures(projectMap, projectId) {
  if (projectId && featureCache.has(projectId)) {
    return featureCache.get(projectId);
  }

  const featureMap = new Map();

  const upsertFeature = (normalized, filePath, type, alias = null) => {
    if (!normalized || NOISE_WORDS.has(normalized)) return;

    if (!featureMap.has(normalized)) {
      featureMap.set(normalized, {
        name: normalized,
        normalizedName: normalized,
        type,
        files: new Set(),
        frequency: 0,
        synonyms: new Set(),
      });
    }
    const feature = featureMap.get(normalized);
    feature.frequency += 1;
    if (alias && alias !== normalized) feature.synonyms.add(alias);
    if (filePath && (filePath.includes("/") || filePath.includes("\\") || filePath.includes("."))) {
      feature.files.add(filePath);
    }
    feature.type = mergeTypePreference(feature.type, type);
  };

  const processItems = (items, preferredType = null) => {
    if (!Array.isArray(items)) return;

    for (const item of items) {
      const filePath = typeof item === "string" ? item : item?.path || item?.name || "";
      if (!filePath || filePath.startsWith(".")) continue;

      const type = preferredType || detectType(filePath);
      const parts = filePath.split(/[/\\]+/);

      for (let part of parts) {
        part = part.replace(/\.[a-zA-Z0-9]+$/, "");
        if (!part || part.startsWith(".") || NOISE_WORDS.has(part.toLowerCase())) continue;

        const normalized = normalizeSegment(part);
        if (!normalized) continue;
        upsertFeature(normalized, filePath, type, part !== normalized ? part : null);
      }
    }
  };

  processItems(projectMap.routes, "api");
  processItems(projectMap.controllers, "backend");
  processItems(projectMap.modules, null);
  processItems(projectMap.priorityFiles || projectMap.files, null);

  const explicitPairs = [
    ["add to cart", "ui"],
    ["shopping cart", "ui"],
    ["product page", "ui"],
  ];
  for (const [phrase, t] of explicitPairs) {
    const key = phrase.toLowerCase();
    const exists = [...featureMap.keys()].some((k) => k.includes(key) || key.includes(k));
    if (exists && !featureMap.has(key)) {
      featureMap.set(key, {
        name: phrase,
        normalizedName: key,
        type: t,
        files: new Set(),
        frequency: 1,
        synonyms: new Set(),
      });
    }
  }

  const explicitScores = {
    checkout: 1,
    "shopping cart": 0.95,
    cart: 0.9,
    payment: 1,
    auth: 0.95,
    product: 0.85,
    order: 0.95,
  };

  const features = [];
  for (const f of featureMap.values()) {
    const fileCount = f.files.size;
    if (isLowValueFeature(f.normalizedName, f.frequency, fileCount)) continue;

    let importanceScore = 0.5;
    if (explicitScores[f.normalizedName] !== undefined) {
      importanceScore = explicitScores[f.normalizedName];
    } else if (/checkout|payment/.test(f.normalizedName)) {
      importanceScore = 1;
    } else if (/auth|login|session/.test(f.normalizedName)) {
      importanceScore = 0.95;
    } else if (/cart|order|product/.test(f.normalizedName)) {
      importanceScore = 0.82;
    }

    const tokens = phraseToTokens(f.normalizedName);
    const primaryStem = derivePrimaryStem(f.normalizedName);
    const synonyms = mergeSynonymAliases(f.normalizedName, [...f.synonyms]);

    features.push({
      name: f.name,
      normalizedName: f.normalizedName,
      files: [...f.files],
      type: f.type,
      importanceScore,
      tokens,
      primaryStem,
      synonyms,
    });
  }

  if (projectId) {
    featureCache.set(projectId, features);
  }

  return features;
}

/**
 * @param {object[]} features
 * @param {object} projectMap — routes/modules/files improve linkage + file evidence
 * @param {string|null} projectId — optional cache key
 */
export function buildFeatureRelationships(features, projectMap = {}, projectId = null) {
  const cacheKey = projectId ? `${projectId}:rel` : null;
  if (cacheKey && relationshipCache.has(cacheKey)) {
    return relationshipCache.get(cacheKey);
  }

  const rels = detectFeatureRelationships(projectMap || {}, features);

  if (cacheKey) {
    relationshipCache.set(cacheKey, rels);
  }

  return rels;
}

export function clearFeatureCaches(projectId) {
  if (projectId) {
    featureCache.delete(projectId);
    relationshipCache.delete(`${projectId}:rel`);
  } else {
    featureCache.clear();
    relationshipCache.clear();
  }
}
