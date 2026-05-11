import { normalize } from "./guardrailService.js";
import {
  CANONICAL_FEATURES,
  resolveCanonicalKeysFromPhrase,
  resolveCatalogKeysFromRawPromptText,
} from "./domainFeatureCatalog.js";
import { normalizeSegment } from "./featureNormalization.js";

/**
 * Merge locally computed edges with persisted Mongo edges (dedupe by source|target|type).
 */
export function mergeRelationshipLists(...lists) {
  const map = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const r of list) {
      if (!r?.source || !r?.target || !r?.type) continue;
      const k = `${String(r.source).toLowerCase()}|${String(r.target).toLowerCase()}|${r.type}`;
      if (!map.has(k)) map.set(k, r);
    }
  }
  return [...map.values()];
}

const SYNONYMS = {
  "buy": ["checkout", "order", "payment"],
  "purchase": ["checkout", "order", "payment"],
  "add": ["cart"],
  "basket": ["cart"],
  "item": ["product"],
  "pay": ["payment", "checkout"],
  "sign in": ["login", "auth"],
  "sign up": ["register", "auth"]
};

const BOOSTS = {
  checkout: 1.0,
  payment: 1.0,
  auth: 0.95,
  authentication: 0.96,
  cart: 0.9,
  product: 0.8,
};

function scoreMatch(promptTokens, featureTokens) {
  const fts = Array.isArray(featureTokens) ? featureTokens : [];
  if (fts.length === 0) return 0;

  let score = 0;
  for (const ft of fts) {
    if (promptTokens.includes(ft)) {
      score += 1.0; // exact match
      continue;
    }
    
    let matched = false;
    for (const [key, syns] of Object.entries(SYNONYMS)) {
       if ((ft === key && promptTokens.some(pt => syns.includes(pt))) ||
           (syns.includes(ft) && promptTokens.includes(key))) {
           score += 0.7; // synonym
           matched = true;
           break;
       }
    }
    if (matched) continue;

    for (const pt of promptTokens) {
        if (pt.includes(ft) || ft.includes(pt)) {
            score += 0.4; // partial word
            break;
        }
    }
  }
  return score / fts.length;
}

/**
 * Catalog keys (e.g. `authentication`) implied by prompt text, using the same
 * token→domain map as path-based feature extraction so words like "login"
 * align with the `authentication` canonical feature.
 */
function catalogKeysFromPrompt(promptText, promptTokens) {
  const keys = new Set();
  for (const pt of promptTokens) {
    const hyphenSplit = String(pt).split("-").filter(Boolean);
    const variants = hyphenSplit.length > 1 ? [pt, ...hyphenSplit] : [pt];
    for (const raw of variants) {
      const phrase = normalizeSegment(raw);
      if (phrase) {
        for (const ck of resolveCanonicalKeysFromPhrase(phrase)) {
          keys.add(ck);
        }
      }
    }
  }
  const collapsed = normalizeSegment(
    String(promptText ?? "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim(),
  );
  if (collapsed) {
    for (const ck of resolveCanonicalKeysFromPhrase(collapsed)) {
      keys.add(ck);
    }
  }
  return keys;
}

function normalizeFeatureLookupKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function catalogKeyForFeature(feature) {
  const nn = normalizeFeatureLookupKey(feature?.normalizedName);
  const display = String(feature?.name ?? "").trim().toLowerCase();
  if (!nn && !display) return null;

  for (const [ck, def] of Object.entries(CANONICAL_FEATURES)) {
    const canonNn = normalizeFeatureLookupKey(def.normalizedName);
    const canonName = String(def.name ?? "").trim().toLowerCase();
    if (nn && canonNn === nn) return ck;
    if (display && canonName === display) return ck;
    if (nn && canonName && nn === canonName) return ck;
  }
  return null;
}

/** Stemmed + literal catalog tokens for overlap when phrase resolution misses (e.g. stemming drift). */
function stemmedCatalogTokenSet(catalogKey) {
  const def = CANONICAL_FEATURES[catalogKey];
  if (!def?.tokens) return new Set();
  const out = new Set();
  for (const tok of def.tokens) {
    out.add(String(tok).toLowerCase());
    for (const x of normalize(String(tok))) {
      out.add(x);
    }
  }
  return out;
}

/**
 * True when prompt tokens overlap catalog vocabulary (exact or cautious substring).
 */
function promptTouchesCatalogTokens(promptTokens, catalogKey, minLen = 4) {
  const bag = stemmedCatalogTokenSet(catalogKey);
  if (!bag.size || !Array.isArray(promptTokens) || promptTokens.length === 0) return false;

  for (const pt of promptTokens) {
    const p = String(pt).toLowerCase();
    if (bag.has(p)) return true;
  }

  for (const pt of promptTokens) {
    const p = String(pt).toLowerCase();
    if (p.length < minLen) continue;
    for (const ct of bag) {
      if (ct.length < minLen) continue;
      if (ct.includes(p) || p.includes(ct)) return true;
    }
  }
  return false;
}

function scoreFromSynonyms(promptTokens, synonyms) {
  if (!Array.isArray(synonyms) || synonyms.length === 0) return 0;
  let best = 0;
  for (const syn of synonyms) {
    if (syn == null) continue;
    const st = normalize(String(syn));
    if (st.length === 0) continue;
    best = Math.max(best, scoreMatch(promptTokens, st));
  }
  return best;
}

function persistedFeatureHintTokens(feature) {
  const hints = [];
  if (Array.isArray(feature?.tokens)) {
    for (const t of feature.tokens) {
      hints.push(...normalize(String(t)));
    }
  }
  if (feature?.primaryStem) {
    hints.push(...normalize(String(feature.primaryStem)));
  }
  return [...new Set(hints)];
}

/**
 * Folder / scaffolding labels that must not be treated as domain features when they are the *only* match.
 */
const META_ONLY_FEATURE_KEYS = new Set([
  "test",
  "tests",
  "spec",
  "specs",
  "generated",
  "generated test",
  "generated tests",
]);

/**
 * Feature names that correspond to real product/domain areas (excludes generic paths like `tests/`).
 * @param {string[]} names
 * @returns {string[]}
 */
export function domainMatchedFeatures(names) {
  const list = Array.isArray(names) ? names : [];
  return list.filter((n) => {
    const key = String(n ?? "")
      .trim()
      .toLowerCase()
      .replace(/-/g, " ");
    return !META_ONLY_FEATURE_KEYS.has(key);
  });
}

export function mapPromptToFeatures(prompt, featuresInDb, relationshipsInDb) {
  const result = {
      decision: "none",
      features: [],
      warnings: [],
      suggestions: []
  };

  if (!prompt || typeof prompt !== "string") return result;

  const promptTokens = normalize(prompt);

  const promptCatalogKeys = new Set([
    ...catalogKeysFromPrompt(prompt, promptTokens),
    ...resolveCatalogKeysFromRawPromptText(prompt),
  ]);

  if (promptTokens.length === 0 && promptCatalogKeys.size === 0) {
    return result;
  }

  const scoredFeatures = [];
  
  for (const feature of featuresInDb) {
      const featureTokens = normalize(feature.normalizedName);
      let matchScore = scoreMatch(promptTokens, featureTokens);
      matchScore = Math.max(
        matchScore,
        scoreFromSynonyms(promptTokens, feature.synonyms),
        scoreMatch(promptTokens, persistedFeatureHintTokens(feature)),
      );
      if (feature?.name) {
        matchScore = Math.max(matchScore, scoreMatch(promptTokens, normalize(String(feature.name))));
      }

      const catalogKey = catalogKeyForFeature(feature);
      if (catalogKey) {
        if (promptCatalogKeys.has(catalogKey)) {
          matchScore = Math.max(matchScore, 0.95);
        } else if (promptTokens.length > 0 && promptTouchesCatalogTokens(promptTokens, catalogKey)) {
          matchScore = Math.max(matchScore, 0.82);
        }
      }
      
      if (matchScore > 0) {
          // Apply Priority Boost
          const boost =
            BOOSTS[feature.normalizedName] ||
            (catalogKey ? BOOSTS[catalogKey] : undefined) ||
            feature.importanceScore ||
            0.5;
          const finalScore = matchScore * boost;

          scoredFeatures.push({
              feature,
              score: finalScore
          });
      }
  }

  scoredFeatures.sort((a, b) => b.score - a.score);

  if (scoredFeatures.length === 0) {
      result.decision = "none";
      result.warnings.push("No matching features found. Please specify a valid domain feature.");
      result.suggestions = featuresInDb.slice(0, 5).map(f => f.normalizedName);
      return result;
  }

  const topScore = scoredFeatures[0].score;
  result.decision = topScore >= 0.8 ? "strong" : "partial";
  
  if (result.decision === "partial") {
      result.warnings.push("Partial match detected. Falling back to related features.");
  }

  // Compile matched features
  for (const sf of scoredFeatures) {
      if (sf.score < 0.3) continue; // Noise filter
      
      const canonical = sf.feature.normalizedName;
      const relatedFeatures = [];
      const seenRel = new Set();
      for (const r of relationshipsInDb || []) {
        if (r.source === canonical && !seenRel.has(r.target)) {
          seenRel.add(r.target);
          relatedFeatures.push({ name: r.target, type: r.type });
        }
        if (r.target === canonical && !seenRel.has(r.source)) {
          seenRel.add(r.source);
          relatedFeatures.push({ name: r.source, type: r.type });
        }
      }

      result.features.push({
          name: sf.feature.normalizedName,
          files: sf.feature.files,
          relatedFeatures: relatedFeatures,
          coverage: 0, 
          confidence: sf.score,
          missingTestAreas: []
      });
  }

  return result;
}

export function generateDebugLog(projectId, extractedFeatures, mappingResult) {
  return {
      event: "feature_pipeline",
      projectId,
      extractedFeatureCount: extractedFeatures.length,
      mappedFeatures: mappingResult.features.map(f => f.name),
      score: mappingResult.features.length > 0 ? mappingResult.features[0].confidence : 0,
      decision: mappingResult.decision,
      coverageSummary: {},
      warnings: mappingResult.warnings
  };
}
