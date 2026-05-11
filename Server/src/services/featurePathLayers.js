/**
 * Classify file paths as touching frontend (UI) vs backend (server) surfaces.
 * Used for feature aggregation and relationship hints.
 */

/**
 * @param {string} filePath
 * @returns {{ frontend: boolean, backend: boolean }}
 */
export function classifySurfaces(filePath) {
  const l = String(filePath).replace(/\\/g, "/").toLowerCase();

  const inClientTree = /(^|\/)client\/|(^|\/)frontend\/|(^|\/)web\/|(^|\/)apps\/web\//.test(l);
  const inServerTree = /(^|\/)server\/|(^|\/)backend\/|(^|\/)srv\//.test(l);

  let frontend = false;
  let backend = false;

  if (inClientTree) {
    frontend = true;
  }

  if (inServerTree) {
    backend = true;
  }

  // Next / Remix / similar: route handlers are backend even under app/
  if (
    /\/(app|src)\/api\/|\/pages\/api\/|(^|\/)api\/route\.|\/route\.(ts|js|tsx|jsx)$|(^|\/)pages\/api\//.test(l)
  ) {
    backend = true;
  }

  // Typical SPA / web UI locations (when not clearly under server/)
  if (
    !inServerTree &&
    (/\/(pages|components|layouts|views|widgets|screens|hooks)\//.test(l) ||
      /\/src\/pages\//.test(l) ||
      /\.(tsx|jsx)$/.test(l))
  ) {
    frontend = true;
  }

  // Client-side data layers
  if (/(^|\/)client\/.*\/(services|api|lib|hooks)\//.test(l)) {
    frontend = true;
  }

  // Server-side code markers (monorepo src without client/ prefix)
  if (
    !inClientTree &&
    (/(^|\/)src\/(routes|controllers|middleware|services|repositories|handlers)\//.test(l) ||
      /(controllers?|middleware|repositories?|handlers)\//.test(l) ||
      /\.routes?\.(js|ts)$/.test(l) ||
      /router\.(js|ts)$/.test(l))
  ) {
    backend = true;
  }

  if (!frontend && !backend && /\.(js|mts|cts|ts|tsx|jsx|mjs|cjs)$/i.test(l)) {
    backend = true;
  }

  return { frontend, backend };
}

/**
 * api | backend | service — only meaningful when {@link classifySurfaces}.backend is true.
 * @param {string} filePath
 * @returns {"api"|"backend"|"service"}
 */
export function detectServerSubtype(filePath) {
  const lowerPath = String(filePath).toLowerCase().replace(/\\/g, "/");
  if (/route|router|\.routes?\.|(^|\/)routes\/|\/route\.(ts|js)/.test(lowerPath)) return "api";
  if (/controller|handlers?\//.test(lowerPath)) return "backend";
  if (/service\.|\/services\/|repository|repos?\//.test(lowerPath)) return "service";
  return "backend";
}

/**
 * Aggregate Mongoose `type` from surface flags and server subtype histogram.
 * @param {boolean} hasFrontend
 * @param {boolean} hasBackend
 * @param {{ api: number, backend: number, service: number }} serverKindCounts
 * @param {string} [catalogDefaultType] — from domainFeatureCatalog
 * @returns {"ui"|"backend"|"api"|"service"|"fullstack"}
 */
export function deriveAggregateFeatureType(hasFrontend, hasBackend, serverKindCounts, catalogDefaultType = "backend") {
  if (hasFrontend && hasBackend) return "fullstack";
  if (hasFrontend) return "ui";

  if (!hasBackend) {
    if (catalogDefaultType === "ui") return "ui";
    return catalogDefaultType || "backend";
  }

  const { api, backend, service } = serverKindCounts;
  if (api >= backend && api >= service && api > 0) return "api";
  if (service >= backend && service >= api && service > 0) return "service";
  return "backend";
}
