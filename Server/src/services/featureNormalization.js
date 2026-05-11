/**
 * Shared feature name normalization for extraction + relationship detection.
 * Goals: camelCase splitting, path-aware tokens, architectural suffix stripping,
 * noise removal, alias-friendly canonical phrases.
 */

export const NOISE_WORDS = new Set([
  "src",
  "client",
  "server",
  "index",
  "config",
  "main",
  "app",
  "utils",
  "util",
  "helpers",
  "helper",
  "test",
  "tests",
  "spec",
  "js",
  "ts",
  "tsx",
  "jsx",
  "mjs",
  "cjs",
  "module",
  "modules",
  "types",
  "constants",
  "styles",
  "assets",
  "public",
  "dist",
  "build",
  "node_modules",
  "vendor",
  "button",
  "buttons",
  "icon",
  "icons",
  "link",
  "links",
  "label",
  "labels",
  "input",
  "inputs",
  "avatar",
  "avatars",
  "badge",
  "badges",
  "chip",
  "chips",
  "divider",
  "skeleton",
  "spinner",
  "wrapper",
  "wrappers",
  "item",
  "items",
  "list",
  "lists",
  "card",
  "cards",
  "form",
  "forms",
  "field",
  "fields",
  "modal",
  "modals",
  "toast",
  "toasts",
  "tooltip",
  "tooltips",
  "hero",
  "banner",
  "banners",
  "header",
  "headers",
  "footer",
  "footers",
  "sidebar",
  "navbar",
  "nav",
  "migration",
  "migrations",
]);

/** Suffix tokens removed from the end of a phrase when deriving domain stems */
export const ARCHITECTURAL_SUFFIXES = new Set([
  "controller",
  "controllers",
  "service",
  "services",
  "route",
  "routes",
  "router",
  "routers",
  "page",
  "pages",
  "component",
  "components",
  "view",
  "views",
  "screen",
  "screens",
  "widget",
  "widgets",
  "layout",
  "layouts",
  "hook",
  "hooks",
  "context",
  "provider",
  "container",
  "module",
  "modules",
  "model",
  "models",
  "schema",
  "schemas",
  "dto",
  "dtos",
  "entity",
  "entities",
  "repository",
  "repositories",
  "middleware",
  "handler",
  "handlers",
  "api",
  "endpoint",
  "endpoints",
]);

/**
 * Split camelCase / PascalCase boundaries (FooBar → Foo Bar).
 */
export function splitCamelCase(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

/**
 * Normalize a path segment or identifier to a spaced lowercase phrase.
 */
export function normalizeSegment(raw) {
  if (!raw || typeof raw !== "string") return "";
  let s = splitCamelCase(raw);
  s = s.replace(/\.[a-zA-Z0-9]+$/g, "");
  s = s.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = s
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 1 && !NOISE_WORDS.has(t));
  return parts.join(" ");
}

/**
 * Strip trailing architectural tokens (e.g. "product controller" → "product").
 */
export function stripArchitecturalTail(tokens) {
  const out = [...tokens];
  while (out.length > 0 && ARCHITECTURAL_SUFFIXES.has(out[out.length - 1])) {
    out.pop();
  }
  return out;
}

/**
 * Primary domain stem for linking UI ↔ routes ↔ controllers.
 */
export function derivePrimaryStem(normalizedPhrase) {
  const tokens = normalizedPhrase.split(/\s+/).filter(Boolean);
  const trimmed = stripArchitecturalTail(tokens);
  if (trimmed.length === 0) return normalizedPhrase.split(/\s+/)[0] || "";
  // Prefer last meaningful token for actions ("add to cart" → cart)
  const domainHints = new Set(["cart", "checkout", "order", "payment", "auth", "product", "user", "account"]);
  for (let i = trimmed.length - 1; i >= 0; i--) {
    if (domainHints.has(trimmed[i])) return trimmed[i];
  }
  return trimmed[trimmed.length - 1];
}

/**
 * Domain tokens used for overlap / dedupe.
 */
export function phraseToTokens(normalizedPhrase) {
  const tokens = normalizedPhrase.split(/\s+/).filter(Boolean);
  return [...new Set(stripArchitecturalTail(tokens))];
}

/**
 * Jaccard similarity on token sets (0–1).
 */
export function tokenSetJaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter++;
  }
  return inter / (a.size + b.size - inter);
}

/**
 * Merge aliases for the same conceptual feature (dedupe edges later).
 */
export function mergeSynonymAliases(name, synonyms = []) {
  const seen = new Set();
  const out = [];
  for (const s of [name, ...synonyms]) {
    const k = String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
