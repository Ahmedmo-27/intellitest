import {
  normalizeSegment,
  derivePrimaryStem,
  phraseToTokens,
  mergeSynonymAliases,
} from "./featureNormalization.js";
import { detectFeatureRelationships } from "./relationshipDetectionEngine.js";
import {
  CANONICAL_FEATURES,
  collectPathCandidates,
  resolveCanonicalKeysFromPhrase,
} from "./domainFeatureCatalog.js";
import {
  classifySurfaces,
  detectServerSubtype,
  deriveAggregateFeatureType,
} from "./featurePathLayers.js";

const featureCache = new Map();
const relationshipCache = new Map();

/** Non-source / asset extensions — keep in sync with `filterPathsForFeatureSync` in the VS Code extension. */
const NON_SOURCE_EXTENSIONS = new Set([
  "png",
  "apng",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
  "svg",
  "pdf",
  "txt",
  "md",
  "markdown",
  "rtf",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "mp4",
  "webm",
  "mov",
  "mp3",
  "wav",
  "zip",
  "tar",
  "gz",
  "tgz",
  "7z",
  "rar",
  "map",
  "lock",
  "sqlite",
  "db",
  "bin",
  "exe",
  "dll",
  "so",
  "dylib",
  "obj",
  "o",
  "a",
  "lib",
  "log",
  "csv",
  "xlsx",
  "xls",
  "ppt",
  "pptx",
  "doc",
  "docx",
  "json",
  "yml",
  "yaml",
  "xml",
  "avif",
  "heic",
]);

const NOISY_BASENAMES = new Set(["robots.txt", "favicon.ico", ".ds_store"]);

/** Top-level folder labels from directory scans — not domain features. */
const STATIC_TOP_LEVEL_FOLDER = new Set([
  "public",
  "static",
  "assets",
  "www",
  "uploads",
  "media",
  "images",
  "img",
  "fonts",
  "fixtures",
]);

/** Extensionless paths must resemble app source (aligned with extension `projectMap` route hints). */
const CODE_PATH_LIKE =
  /route|router|pages\/|\/pages|\/app\/|^app\/|\/api\/|^api\/|controller|endpoint|\/src\/|^src\/|\/components\/|\/services\/|\/handlers\/|\/screens\/|\/layouts\/|\/views\/|\/widgets\/|\/models\/|\/schemas\/|\/server\/|\/client\/|\/lib\/|\/utils\/|repository\/|repos?\//i;

/**
 * Whether a relative path should contribute to feature extraction (FE/BE source-like only).
 * @param {string} filePath
 * @returns {boolean}
 */
export function shouldIncludePathForFeatures(filePath) {
  const norm = String(filePath).replace(/\\/g, "/").trim();
  if (!norm || norm.startsWith(".")) return false;

  const basename = norm.split("/").pop() || "";
  if (!basename || basename.startsWith(".")) return false;

  const baseLower = basename.toLowerCase();
  if (NOISY_BASENAMES.has(baseLower)) return false;

  const dot = basename.lastIndexOf(".");
  if (dot > 0) {
    const ext = basename.slice(dot + 1).toLowerCase();
    if (NON_SOURCE_EXTENSIONS.has(ext)) return false;
    return true;
  }

  return CODE_PATH_LIKE.test(norm);
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

  const upsertCanonical = (canonicalKey, filePath, stemAliases) => {
    const meta = CANONICAL_FEATURES[canonicalKey];
    if (!meta) return;

    if (!featureMap.has(canonicalKey)) {
      featureMap.set(canonicalKey, {
        name: meta.name,
        normalizedName: meta.normalizedName,
        catalogDefaultType: meta.type,
        importanceScore: meta.importanceScore,
        files: new Set(),
        frequency: 0,
        synonyms: new Set(),
        hasFrontend: false,
        hasBackend: false,
        serverKindCounts: { api: 0, backend: 0, service: 0 },
      });
    }
    const feature = featureMap.get(canonicalKey);
    feature.frequency += 1;
    feature.importanceScore = Math.max(feature.importanceScore, meta.importanceScore);

    const surf = classifySurfaces(filePath);
    if (surf.frontend) feature.hasFrontend = true;
    if (surf.backend) {
      feature.hasBackend = true;
      const sub = detectServerSubtype(filePath);
      feature.serverKindCounts[sub] += 1;
    }

    for (const stem of stemAliases) {
      if (!stem) continue;
      const aliasNorm = normalizeSegment(stem);
      if (aliasNorm && aliasNorm !== meta.normalizedName) feature.synonyms.add(stem);
    }

    if (filePath && (filePath.includes("/") || filePath.includes("\\") || filePath.includes("."))) {
      feature.files.add(filePath);
    }
  };

  const processPaths = (items) => {
    if (!Array.isArray(items)) return;

    for (const item of items) {
      const filePath = typeof item === "string" ? item : item?.path || item?.name || "";
      if (!filePath || filePath.startsWith(".")) continue;

      const bareTopLevel =
        !filePath.includes("/") &&
        !filePath.includes("\\") &&
        !filePath.includes(".");
      if (bareTopLevel && STATIC_TOP_LEVEL_FOLDER.has(filePath.toLowerCase())) continue;

      if (!shouldIncludePathForFeatures(filePath)) continue;

      const keyToStems = new Map();

      for (const stem of collectPathCandidates(filePath)) {
        const norm = normalizeSegment(stem);
        if (!norm) continue;
        for (const ck of resolveCanonicalKeysFromPhrase(norm)) {
          if (!CANONICAL_FEATURES[ck]) continue;
          if (!keyToStems.has(ck)) keyToStems.set(ck, new Set());
          keyToStems.get(ck).add(stem);
        }
      }

      for (const [ck, stems] of keyToStems) {
        upsertCanonical(ck, filePath, stems);
      }
    }
  };

  processPaths(projectMap.routes);
  processPaths(projectMap.controllers);
  processPaths(projectMap.modules);
  processPaths(projectMap.priorityFiles || projectMap.files);

  const features = [];
  for (const f of featureMap.values()) {
    const fileCount = f.files.size;
    if (isLowValueFeature(f.normalizedName, f.frequency, fileCount)) continue;

    const importanceScore = f.importanceScore ?? 0.5;

    const tokens = phraseToTokens(f.normalizedName);
    const primaryStem = derivePrimaryStem(f.normalizedName);
    const synonyms = mergeSynonymAliases(f.normalizedName, [...f.synonyms]);

    const type = deriveAggregateFeatureType(
      f.hasFrontend,
      f.hasBackend,
      f.serverKindCounts,
      f.catalogDefaultType,
    );

    features.push({
      name: f.name,
      normalizedName: f.normalizedName,
      files: [...f.files],
      type,
      hasFrontend: f.hasFrontend,
      hasBackend: f.hasBackend,
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
