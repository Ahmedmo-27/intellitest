/**
 * Dependency-aware relationship detection for feature intelligence.
 * Uses structure (paths, stems, types), proximity, token overlap, and curated flows.
 * Outputs scored edges with evidence + file hints — no fabricated semantic ties.
 */

import {
  derivePrimaryStem,
  phraseToTokens,
  tokenSetJaccard,
  NOISE_WORDS,
} from "./featureNormalization.js";
import { shouldKeepEdge } from "./graphQualityFilters.js";

export const RELATION_TYPES = [
  "depends_on",
  "triggers",
  "ui_for",
  "belongs_to",
  "extends",
  "uses",
  "validates",
  "updates",
  "reads_from",
  "writes_to",
];

const MIN_CONFIDENCE = 0.42;
const MAX_EDGES_PER_SOURCE = 12;

function refineEdgeConfidence(edge) {
  let c = edge.confidence;
  const n = Array.isArray(edge.files) ? edge.files.length : 0;
  if (n >= 2) {
    c += 0.025 * Math.min(n, 5);
  }
  if (n === 0) {
    const ev = (Array.isArray(edge.evidence) ? edge.evidence : []).join(" ").toLowerCase();
    if (/overlap|adjacent|semantic token|jaccard/.test(ev)) {
      c *= 0.88;
    }
  }
  return Math.min(0.97, Math.max(MIN_CONFIDENCE, Math.round(c * 1000) / 1000));
}

function enrichFilesFromFeatures(edge, nameToFeat) {
  const a = nameToFeat.get(edge.source);
  const b = nameToFeat.get(edge.target);
  if (!a || !b) return;
  const existing = new Set(edge.files || []);
  if (existing.size > 0) return;
  const pool = [
    ...new Set([...(a.files || []), ...(b.files || [])].filter(Boolean)),
  ].sort((x, y) => x.length - y.length);
  const pick = pool.slice(0, 10);
  if (pick.length === 0) return;
  edge.files = pick;
  const hint = pick.length <= 2 ? pick.join("; ") : `${pick[0]}; ${pick[1]} (+${pick.length - 2} more)`;
  const ev = Array.isArray(edge.evidence) ? [...edge.evidence] : [];
  ev.push(`supporting paths from feature file lists: ${hint}`);
  edge.evidence = ev;
}

/** High-confidence business flows (tokens match feature names / stems) */
const FLOW_RULES = [
  { keys: ["checkout"], targetStem: "cart", type: "depends_on", confidence: 0.92, evidence: "flow: checkout requires cart" },
  { keys: ["checkout"], targetStem: "payment", type: "triggers", confidence: 0.9, evidence: "flow: checkout triggers payment" },
  { keys: ["checkout"], targetStem: "order", type: "triggers", confidence: 0.88, evidence: "flow: checkout creates order" },
  { keys: ["cart"], targetStem: "product", type: "depends_on", confidence: 0.9, evidence: "flow: cart references catalog" },
  { keys: ["order"], targetStem: "payment", type: "depends_on", confidence: 0.85, evidence: "flow: order settlement" },
  { keys: ["login", "signin", "sign_in"], targetStem: "auth", type: "belongs_to", confidence: 0.88, evidence: "flow: login under auth" },
];

function parentDir(path, depth = 2) {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(0, Math.max(1, parts.length - depth)).join("/").toLowerCase();
}

function routeLikeSegments(filePath) {
  const lower = filePath.toLowerCase().replace(/\\/g, "/");
  const out = new Set();
  const matches = lower.match(/\/(?:api|v\d+)?\/?([a-z][a-z0-9_-]*)/g);
  if (matches) {
    for (const m of matches) {
      const seg = m.replace(/^\/+/, "").split("/").pop();
      if (seg && seg.length > 2 && !NOISE_WORDS.has(seg)) out.add(seg);
    }
  }
  return out;
}

function featureMatchesKeys(normalizedName, tokens, stem, keys) {
  const blob = `${normalizedName} ${[...tokens].join(" ")} ${stem}`.toLowerCase().replace(/_/g, " ");
  for (const k of keys) {
    const kk = k.toLowerCase();
    if (blob.includes(kk)) return true;
    if (tokens.has(kk)) return true;
    if (stem === kk) return true;
  }
  return false;
}

function stemToFeatures(featuresByStem, stem) {
  return featuresByStem.get(stem) || [];
}

/**
 * @param {object} projectMap
 * @param {Array<object>} features — from extractFeatures (normalizedName, type, files, tokens, primaryStem, importanceScore)
 * @returns {Array<{source:string,target:string,type:string,confidence:number,evidence:string[],files:string[],metadata?:object}>}
 */
export function detectFeatureRelationships(projectMap, features) {
  if (!Array.isArray(features) || features.length === 0) return [];

  const enriched = features.map((f) => {
    const tokens = new Set(
      Array.isArray(f.tokens) ? f.tokens : phraseToTokens(f.normalizedName || f.name || ""),
    );
    const stem = f.primaryStem || derivePrimaryStem(f.normalizedName || "");
    const dirs = new Set((f.files || []).map((p) => parentDir(p, 2)));
    const routeSegs = new Set();
    for (const file of f.files || []) {
      for (const s of routeLikeSegments(file)) routeSegs.add(s);
    }
    return { ...f, tokens, stem, dirs, routeSegs };
  });

  const featuresByStem = new Map();
  for (const f of enriched) {
    if (!f.stem) continue;
    if (!featuresByStem.has(f.stem)) featuresByStem.set(f.stem, []);
    featuresByStem.get(f.stem).push(f);
  }

  const nameSet = new Set(enriched.map((f) => f.normalizedName));

  const candidates = [];

  const pushEdge = (source, target, type, confidence, evidence, files = [], metadata = {}) => {
    if (!source || !target || source === target) return;
    if (!nameSet.has(source) || !nameSet.has(target)) return;
    if (confidence < MIN_CONFIDENCE) return;
    const fileList = [...new Set(files.filter(Boolean))].slice(0, 12);
    const edge = {
      source,
      target,
      type,
      confidence: Math.min(1, Math.round(confidence * 1000) / 1000),
      evidence: Array.isArray(evidence) ? evidence.filter(Boolean) : [evidence].filter(Boolean),
      files: fileList,
      metadata,
    };
    if (edge.confidence < MIN_CONFIDENCE) return;
    candidates.push(edge);
  };

  // ── 1) Curated business flows ────────────────────────────────────────────
  for (const f of enriched) {
    const nm = (f.normalizedName || "").toLowerCase();
    const stem = f.stem;
    const tokens = f.tokens;
    for (const rule of FLOW_RULES) {
      if (!featureMatchesKeys(nm, tokens, stem, rule.keys)) continue;
      const targets = stemToFeatures(featuresByStem, rule.targetStem);
      for (const t of targets) {
        pushEdge(f.normalizedName, t.normalizedName, rule.type, rule.confidence, rule.evidence, sharedFiles(f.files, t.files));
      }
    }
  }

  // ── 2) Stem-aligned UI ↔ API/backend (critical FE↔BE link) ───────────────
  for (const f of enriched) {
    if (!f.stem) continue;
    const peers = stemToFeatures(featuresByStem, f.stem).filter((x) => x.normalizedName !== f.normalizedName);
    for (const p of peers) {
      const files12 = sharedFiles(f.files, p.files);
      if (f.type === "ui" && (p.type === "api" || p.type === "backend")) {
        pushEdge(f.normalizedName, p.normalizedName, "ui_for", 0.82 + Math.min(0.08, files12.length * 0.02), "stem match: UI targets backend/route family", files12);
      } else if ((f.type === "api" || f.type === "backend") && p.type === "ui") {
        pushEdge(p.normalizedName, f.normalizedName, "ui_for", 0.82 + Math.min(0.08, files12.length * 0.02), "stem match: UI targets backend/route family", files12);
      }

      if (f.type === "backend" && p.type === "service" && f.stem === p.stem) {
        pushEdge(f.normalizedName, p.normalizedName, "uses", 0.86, "controller/handler uses same-stem service", files12);
      }
      if (f.type === "service" && p.type === "backend" && f.stem === p.stem) {
        pushEdge(p.normalizedName, f.normalizedName, "writes_to", 0.72, "service persists via same-stem backend layer", files12);
      }
    }
  }

  // ── 3) Shared route segments ↔ features ─────────────────────────────────
  for (const f of enriched) {
    if (f.routeSegs.size === 0) continue;
    for (const p of enriched) {
      if (p.normalizedName === f.normalizedName) continue;
      let overlap = 0;
      const sharedSeg = [];
      for (const s of f.routeSegs) {
        if (p.tokens.has(s) || p.stem === s) {
          overlap++;
          sharedSeg.push(s);
        }
      }
      if (overlap === 0) continue;
      const files12 = sharedFiles(f.files, p.files);
      const conf = 0.55 + Math.min(0.2, overlap * 0.06) + Math.min(0.08, files12.length * 0.02);
      const ev = `shared route segment: ${sharedSeg.slice(0, 3).join(", ")}`;
      if (f.type === "ui" && p.type !== "ui") {
        pushEdge(f.normalizedName, p.normalizedName, "ui_for", conf, ev, files12);
      } else {
        pushEdge(f.normalizedName, p.normalizedName, "depends_on", conf * 0.92, ev, files12);
      }
    }
  }

  // ── 4) Shared files — index by path to avoid O(n²) over features ───────────
  const fileToFeats = new Map();
  for (const f of enriched) {
    for (const file of f.files || []) {
      if (!fileToFeats.has(file)) fileToFeats.set(file, []);
      fileToFeats.get(file).push(f);
    }
  }
  for (const [, list] of fileToFeats) {
    if (list.length < 2) continue;
    const uniq = [...new Map(list.map((x) => [x.normalizedName, x])).values()];
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const a = uniq[i];
        const b = uniq[j];
        const sf = sharedFiles(a.files, b.files);
        if (sf.length === 0) continue;

        if (a.type === "ui" && b.type !== "ui") {
          pushEdge(a.normalizedName, b.normalizedName, "ui_for", 0.78 + Math.min(0.07, sf.length * 0.01), "co-located UI + implementation files", sf);
        } else if (b.type === "ui" && a.type !== "ui") {
          pushEdge(b.normalizedName, a.normalizedName, "ui_for", 0.78 + Math.min(0.07, sf.length * 0.01), "co-located UI + implementation files", sf);
        } else if (a.type === "backend" && b.type === "service") {
          pushEdge(a.normalizedName, b.normalizedName, "uses", 0.74, "shared module: handler delegates to service", sf);
        } else if (b.type === "backend" && a.type === "service") {
          pushEdge(b.normalizedName, a.normalizedName, "uses", 0.74, "shared module: handler delegates to service", sf);
        } else if (a.type === "api" && (b.type === "backend" || b.type === "service")) {
          pushEdge(a.normalizedName, b.normalizedName, "reads_from", 0.7, "route wires into implementation", sf);
        } else if (b.type === "api" && (a.type === "backend" || a.type === "service")) {
          pushEdge(b.normalizedName, a.normalizedName, "reads_from", 0.7, "route wires into implementation", sf);
        } else {
          const conf = 0.52 + Math.min(0.12, sf.length * 0.02);
          pushEdge(a.normalizedName, b.normalizedName, "depends_on", conf, "shared codebase footprint", sf);
        }
      }
    }
  }

  // ── 5) Directory proximity (same feature area) ───────────────────────────
  for (let i = 0; i < enriched.length; i++) {
    for (let j = i + 1; j < enriched.length; j++) {
      const a = enriched[i];
      const b = enriched[j];
      let sharedDirs = 0;
      for (const d of a.dirs) {
        if (d && b.dirs.has(d)) sharedDirs++;
      }
      if (sharedDirs === 0) continue;
      const jacc = tokenSetJaccard(a.tokens, b.tokens);
      if (jacc < 0.22 && a.stem !== b.stem) continue;
      const conf = 0.42 + Math.min(0.18, sharedDirs * 0.04 + jacc * 0.25);
      pushEdge(a.normalizedName, b.normalizedName, "depends_on", conf, "adjacent modules / shared package path", []);
    }
  }

  // ── 6) Token overlap (weak signal) — inverted index when graph is large ───
  const tokenToFeats = new Map();
  for (const f of enriched) {
    for (const t of f.tokens) {
      if (t.length < 3) continue;
      if (!tokenToFeats.has(t)) tokenToFeats.set(t, []);
      tokenToFeats.get(t).push(f);
    }
  }
  const seenPairs = new Set();
  const considerPair = (a, b) => {
    if (a.normalizedName >= b.normalizedName) return;
    const pk = `${a.normalizedName}|${b.normalizedName}`;
    if (seenPairs.has(pk)) return;
    seenPairs.add(pk);
    const jac = tokenSetJaccard(a.tokens, b.tokens);
    if (jac < 0.42) return;
    const conf = 0.42 + jac * 0.32;
    pushEdge(a.normalizedName, b.normalizedName, "depends_on", conf, `semantic token overlap (jaccard ${jac.toFixed(2)})`, []);
  };
  if (enriched.length <= 220) {
    for (let i = 0; i < enriched.length; i++) {
      for (let j = i + 1; j < enriched.length; j++) considerPair(enriched[i], enriched[j]);
    }
  } else {
    for (const [, list] of tokenToFeats) {
      const uniq = [...new Map(list.map((x) => [x.normalizedName, x])).values()];
      if (uniq.length > 80) continue;
      for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) considerPair(uniq[i], uniq[j]);
      }
    }
  }

  // ── 7) Validation / auth touches ──────────────────────────────────────────
  for (const f of enriched) {
    const nm = `${f.normalizedName} ${[...f.tokens].join(" ")}`;
    if (/checkout|payment|order|profile|account/i.test(nm)) {
      const authFeat = enriched.find((x) => /auth|session|login|user/i.test(x.normalizedName));
      if (authFeat && authFeat.normalizedName !== f.normalizedName) {
        pushEdge(f.normalizedName, authFeat.normalizedName, "validates", 0.62, "protected domain likely gated by auth", sharedFiles(f.files, authFeat.files));
      }
    }
  }

  // ── Dedupe + cap per source ────────────────────────────────────────────────
  const bestByKey = new Map();
  for (const e of candidates) {
    const k = `${e.source}|${e.target}|${e.type}`;
    const prev = bestByKey.get(k);
    if (!prev || e.confidence > prev.confidence) bestByKey.set(k, e);
  }

  let merged = [...bestByKey.values()];

  const nameToFeat = new Map(enriched.map((f) => [f.normalizedName, f]));
  for (const e of merged) {
    enrichFilesFromFeatures(e, nameToFeat);
    e.confidence = refineEdgeConfidence(e);
  }

  merged = merged.filter((e) =>
    shouldKeepEdge(e.source, e.target, e.type, e.confidence, e.files?.length || 0),
  );

  const bySource = new Map();
  for (const e of merged) {
    if (!bySource.has(e.source)) bySource.set(e.source, []);
    bySource.get(e.source).push(e);
  }

  const pruned = [];
  for (const [, arr] of bySource) {
    arr.sort((x, y) => y.confidence - x.confidence);
    pruned.push(...arr.slice(0, MAX_EDGES_PER_SOURCE));
  }

  return pruned.sort((a, b) => b.confidence - a.confidence);
}

function sharedFiles(a = [], b = []) {
  const sb = new Set(b);
  return a.filter((x) => sb.has(x));
}

/**
 * Lightweight relationship pass when only feature list is available (no full map).
 */
export function detectFeatureRelationshipsFromFeatures(features) {
  return detectFeatureRelationships({}, features);
}
