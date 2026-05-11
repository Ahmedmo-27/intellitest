/**
 * Filters noisy “folder bucket” features from the relationship graph.
 */

export const STRUCTURAL_BUCKET_LABELS = new Set([
  "pages",
  "page",
  "services",
  "service",
  "controllers",
  "controller",
  "middleware",
  "models",
  "model",
  "repositories",
  "repository",
  "routes",
  "route",
  "routers",
  "router",
  "components",
  "component",
  "lib",
  "hooks",
  "hook",
  "context",
  "contexts",
  "utils",
  "util",
  "helpers",
  "helper",
  "scripts",
  "script",
  "types",
  "type",
  "schema",
  "schemas",
  "layouts",
  "layout",
  "assets",
  "views",
  "view",
  "modules",
  "module",
  "api",
  "site",
  "sites",
  "data",
  "constants",
  "translations",
  "i18n",
  "seo",
  "smtp",
  "database",
  "db",
  "public",
  "dist",
  "providers",
  "provider",
  "containers",
  "container",
  "handlers",
  "handler",
  "endpoints",
  "endpoint",
  "widgets",
  "widget",
  "screens",
  "screen",
  "generated tests",
  "generated test",
  "specs",
  "spec",
  "configs",
  "config",
  "tests",
  "test",
  "documentation",
  "docs",
  "admin",
  "stores",
  "store",
]);

export function isStructuralBucket(normalizedName) {
  const key = String(normalizedName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!key) return true;
  return STRUCTURAL_BUCKET_LABELS.has(key);
}

/**
 * @param {string} type
 * @param {number} confidence
 * @param {number} fileCount — shared or inferred supporting paths
 */
export function shouldKeepEdge(source, target, type, confidence, fileCount) {
  const srcBucket = isStructuralBucket(source);
  const tgtBucket = isStructuralBucket(target);

  if (srcBucket && tgtBucket) return false;

  const flowTier = confidence >= 0.85;

  if (type === "ui_for") {
    if (srcBucket) return false;
    if (tgtBucket && fileCount === 0 && !flowTier) return false;
    return true;
  }

  if (type === "triggers") {
    if (srcBucket && fileCount === 0) return false;
    return true;
  }

  if (tgtBucket) {
    if (flowTier && fileCount > 0) return true;
    return false;
  }

  if (srcBucket) {
    return false;
  }

  return true;
}
