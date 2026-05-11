/**
 * Graph utilities for dependency tracing, impact analysis, and risk propagation.
 * Works on plain relationship rows ({ source, target, type, confidence, ... }).
 */

/** Outgoing edges from X that mean “X relies on / is gated by Y” */
const UPSTREAM_TYPES = new Set([
  "depends_on",
  "uses",
  "reads_from",
  "extends",
  "belongs_to",
  "validates",
]);

function normalizeFeatureKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildAdjacency(relationships) {
  const outgoing = new Map();
  const incoming = new Map();
  const addOut = (s, t, edge) => {
    if (!outgoing.has(s)) outgoing.set(s, []);
    outgoing.get(s).push({ node: t, edge });
  };
  const addIn = (s, t, edge) => {
    if (!incoming.has(t)) incoming.set(t, []);
    incoming.get(t).push({ node: s, edge });
  };

  for (const r of relationships || []) {
    const s = normalizeFeatureKey(r.source);
    const t = normalizeFeatureKey(r.target);
    if (!s || !t) continue;
    addOut(s, t, r);
    addIn(s, t, r);
  }
  return { outgoing, incoming };
}

/**
 * Walk upstream dependencies (what this feature relies on).
 */
export function getUpstreamDependencies(featureName, relationships, maxDepth = 8) {
  const start = normalizeFeatureKey(featureName);
  const { outgoing } = buildAdjacency(relationships);
  const visited = new Map();

  function walk(node, depth) {
    if (depth > maxDepth) return;
    const edges = outgoing.get(node) || [];
    for (const { node: next, edge } of edges) {
      if (!UPSTREAM_TYPES.has(edge.type)) continue;
      if (visited.has(next)) continue;
      visited.set(next, depth + 1);
      walk(next, depth + 1);
    }
  }

  walk(start, 0);
  return [...visited.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
}

/**
 * Walk downstream impact (features that may break if this feature fails).
 */
export function getDownstreamImpact(featureName, relationships, maxDepth = 8) {
  const start = normalizeFeatureKey(featureName);
  const { outgoing, incoming } = buildAdjacency(relationships);
  const visited = new Map();

  function walk(node, depth) {
    if (depth > maxDepth) return;

    // Consumers that declare they depend on `node`
    for (const { node: consumer, edge } of incoming.get(node) || []) {
      if (!["depends_on", "uses", "reads_from"].includes(edge.type)) continue;
      if (visited.has(consumer)) continue;
      visited.set(consumer, depth + 1);
      walk(consumer, depth + 1);
    }

    // Effects emitted by `node`
    for (const { node: effect, edge } of outgoing.get(node) || []) {
      if (!["triggers", "updates", "writes_to"].includes(edge.type)) continue;
      if (visited.has(effect)) continue;
      visited.set(effect, depth + 1);
      walk(effect, depth + 1);
    }

    // UI surfaces backed by this implementation (edge: ui --ui_for--> impl)
    for (const { node: ui, edge } of incoming.get(node) || []) {
      if (edge.type !== "ui_for") continue;
      if (visited.has(ui)) continue;
      visited.set(ui, depth + 1);
      walk(ui, depth + 1);
    }
  }

  walk(start, 0);
  return [...visited.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
}

/**
 * Shortest dependency path from `from` to `to` following upstream depends/uses edges.
 */
export function shortestDependencyPath(from, to, relationships) {
  const a = normalizeFeatureKey(from);
  const b = normalizeFeatureKey(to);
  const { outgoing } = buildAdjacency(relationships);
  const queue = [[a, [a]]];
  const seen = new Set([a]);

  while (queue.length) {
    const [node, path] = queue.shift();
    if (node === b) return path;

    for (const { node: next, edge } of outgoing.get(node) || []) {
      if (!["depends_on", "uses", "reads_from", "extends"].includes(edge.type)) continue;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([next, [...path, next]]);
    }
  }
  return null;
}

/**
 * Detect simple cycles over depends_on / uses edges (directed).
 */
export function detectCircularDependencies(relationships) {
  const { outgoing } = buildAdjacency(relationships);
  const cycles = [];
  const visited = new Set();
  const recStack = new Set();
  const pathStack = [];

  function dfs(node) {
    visited.add(node);
    recStack.add(node);
    pathStack.push(node);

    for (const { node: next, edge } of outgoing.get(node) || []) {
      if (!["depends_on", "uses", "reads_from"].includes(edge.type)) continue;
      if (!visited.has(next)) {
        dfs(next);
      } else if (recStack.has(next)) {
        const idx = pathStack.indexOf(next);
        if (idx >= 0) cycles.push([...pathStack.slice(idx), next]);
      }
    }

    pathStack.pop();
    recStack.delete(node);
  }

  for (const n of outgoing.keys()) {
    if (!visited.has(n)) dfs(n);
  }

  const uniq = new Set(cycles.map((c) => c.join("→")));
  return [...uniq].map((s) => s.split("→"));
}

/**
 * Rank likely failure contributors upstream of a symptom feature.
 */
export function analyzeFeatureImpact(featureName, relationships, featuresByName = {}) {
  const key = normalizeFeatureKey(featureName);
  const upstream = getUpstreamDependencies(key, relationships, 10);
  const downstream = getDownstreamImpact(key, relationships, 6);

  const importance = (name) => {
    const f = featuresByName[normalizeFeatureKey(name)] || featuresByName[name];
    return typeof f?.importanceScore === "number" ? f.importanceScore : 0.5;
  };

  const weightedUpstream = upstream.map((n) => ({
    name: n,
    importance: importance(n),
    score: importance(n),
  }));

  weightedUpstream.sort((a, b) => b.score - a.score);

  const infraHints = ["auth", "payment", "cart", "order", "product", "session", "user"];
  const likelyRootCauses = weightedUpstream
    .filter((x) => infraHints.some((h) => x.name.includes(h)))
    .slice(0, 8)
    .map((x) => x.name);

  if (likelyRootCauses.length === 0) {
    likelyRootCauses.push(...weightedUpstream.slice(0, 5).map((x) => x.name));
  }

  const dependencyChain = upstream.slice(0, 12);

  const criticalPaths = [];
  for (const candidate of likelyRootCauses.slice(0, 4)) {
    const p = shortestDependencyPath(key, candidate, relationships);
    if (p && p.length > 1) criticalPaths.push([...p].reverse());
  }

  const coupling = (relationships || []).filter(
    (r) => normalizeFeatureKey(r.source) === key || normalizeFeatureKey(r.target) === key,
  ).length;

  const riskScore = Math.min(
    1,
    importance(key) * 0.35 +
      Math.min(1, upstream.length / 10) * 0.25 +
      Math.min(1, coupling / 12) * 0.25 +
      Math.min(1, downstream.length / 8) * 0.15,
  );

  return {
    feature: key,
    affectedFeatures: downstream,
    dependencyChain,
    likelyRootCauses: [...new Set(likelyRootCauses)],
    riskScore: Math.round(riskScore * 1000) / 1000,
    criticalPaths: criticalPaths.slice(0, 5),
  };
}

/**
 * Extract high-importance linear chains (for QA prioritization).
 */
export function extractCriticalFlows(relationships, featuresByName = {}, maxChains = 8) {
  const { outgoing } = buildAdjacency(relationships);
  const importance = (name) => {
    const f = featuresByName[normalizeFeatureKey(name)] || featuresByName[name];
    return typeof f?.importanceScore === "number" ? f.importanceScore : 0.45;
  };

  const seeds = [...outgoing.keys()].filter((n) => importance(n) >= 0.85);
  const chains = [];

  function extend(start) {
    const path = [start];
    let cur = start;
    for (let i = 0; i < 12; i++) {
      const outs = (outgoing.get(cur) || []).filter((x) =>
        ["depends_on", "triggers", "uses"].includes(x.edge.type),
      );
      if (!outs.length) break;
      outs.sort((a, b) => (b.edge.confidence || 0) - (a.edge.confidence || 0));
      cur = outs[0].node;
      if (path.includes(cur)) break;
      path.push(cur);
    }
    return path.length >= 3 ? path : null;
  }

  for (const s of seeds) {
    const p = extend(s);
    if (p) chains.push(p);
  }

  return chains.slice(0, maxChains);
}
