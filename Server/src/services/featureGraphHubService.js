/**
 * Build compact hub documents from flat detector edges, and flatten back for graph algorithms.
 */

/**
 * @param {Array<{source:string,target:string,type:string,confidence?:number,evidence?:string[],files?:string[]}>} edges
 * @returns {Map<string, { outgoing: object[] }>}
 */
export function groupEdgesByHub(edges) {
  const byHub = new Map();

  for (const e of edges || []) {
    const hub = e?.source != null ? String(e.source).trim() : "";
    const tgt = e?.target != null ? String(e.target).trim() : "";
    const typ = e?.type != null ? String(e.type).trim() : "";
    if (!hub || !tgt || !typ) continue;
    const dedupeKey = `${typ}|${tgt.toLowerCase()}`;
    if (!byHub.has(hub)) {
      byHub.set(hub, new Map());
    }
    const dedupe = byHub.get(hub);
    const next = {
      type: typ,
      target: tgt,
      confidence: typeof e.confidence === "number" ? e.confidence : 0.5,
      evidence: Array.isArray(e.evidence) ? [...e.evidence] : [],
      files: Array.isArray(e.files) ? [...e.files] : [],
    };
    const prev = dedupe.get(dedupeKey);
    if (!prev || next.confidence > prev.confidence) {
      dedupe.set(dedupeKey, next);
    }
  }

  const result = new Map();
  for (const [hub, dedupe] of byHub) {
    const outgoing = [...dedupe.values()].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    result.set(hub, { outgoing });
  }
  return result;
}

function unionFilesTop(outgoing, max = 24) {
  const seen = new Set();
  const out = [];
  for (const o of outgoing || []) {
    for (const f of o.files || []) {
      if (f && !seen.has(f)) {
        seen.add(f);
        out.push(f);
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

function unionEvidenceTop(outgoing, maxLines = 8) {
  const seen = new Set();
  const out = [];
  for (const o of outgoing || []) {
    for (const line of o.evidence || []) {
      const s = String(line).trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
        if (out.length >= maxLines) return out;
      }
    }
  }
  return out;
}

/**
 * @param {string} userId
 * @param {string} projectId
 * @param {Map<string, { outgoing: object[] }>} grouped
 * @returns {object[]} Mongo insert-ready plain objects
 */
export function hubsToInsertDocs(userId, projectId, grouped) {
  const docs = [];
  for (const [hubFeature, { outgoing }] of grouped) {
    if (!outgoing.length) continue;
    docs.push({
      userId,
      projectId,
      hubFeature,
      outgoing,
      aggregateFiles: unionFilesTop(outgoing),
      summaryEvidence: unionEvidenceTop(outgoing),
    });
  }
  return docs;
}

/**
 * Expand hub documents to the flat edge list the rest of the codebase expects.
 * @param {object[]} hubs — lean FeatureRelationship hub docs
 * @returns {object[]}
 */
export function flattenHubsToEdges(hubs) {
  const edges = [];
  for (const h of hubs || []) {
    const hub = h.hubFeature;
    for (const o of h.outgoing || []) {
      edges.push({
        userId: h.userId,
        projectId: h.projectId,
        source: hub,
        target: o.target,
        type: o.type,
        confidence: o.confidence,
        evidence: o.evidence || [],
        files: o.files || [],
        _compact: true,
        _hubId: h._id,
      });
    }
  }
  return edges;
}
