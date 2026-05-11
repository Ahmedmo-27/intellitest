/**
 * Maps route segments, folder names, and file stems to canonical product capabilities.
 * Avoids treating arbitrary path tokens (e.g. design layers) as domain features.
 */

import { normalizeSegment, NOISE_WORDS } from "./featureNormalization.js";

/** @typedef {{ name: string, normalizedName: string, type: string, importanceScore: number, tokens: string[] }} CanonicalFeatureDef */

/** @type {Record<string, CanonicalFeatureDef>} */
export const CANONICAL_FEATURES = {
  authentication: {
    name: "Authentication",
    normalizedName: "authentication",
    type: "backend",
    importanceScore: 0.96,
    tokens: [
      "auth",
      "authenticate",
      "authentication",
      "login",
      "logout",
      "signin",
      "signup",
      "signing",
      "register",
      "registration",
      "session",
      "sessions",
      "oauth",
      "jwt",
      "password",
      "passwords",
      "credential",
      "credentials",
      "mfa",
      "2fa",
      "otp",
      "verify",
      "verification",
      "reset",
    ],
  },
  authorization: {
    name: "Authorization",
    normalizedName: "authorization",
    type: "backend",
    importanceScore: 0.94,
    tokens: ["authorization", "permission", "permissions", "role", "roles", "rbac", "acl", "policy", "policies"],
  },
  payment: {
    name: "Payment",
    normalizedName: "payment",
    type: "backend",
    importanceScore: 0.98,
    tokens: [
      "payment",
      "payments",
      "pay",
      "billing",
      "invoice",
      "invoices",
      "stripe",
      "paypal",
      "transactions",
      "subscription",
      "subscriptions",
      "refund",
      "refunds",
      "wallet",
      "pricing",
      "charge",
      "charges",
    ],
  },
  checkout: {
    name: "Checkout",
    normalizedName: "checkout",
    type: "api",
    importanceScore: 0.97,
    tokens: ["checkout", "fulfillment"],
  },
  orders: {
    name: "Orders",
    normalizedName: "orders",
    type: "backend",
    importanceScore: 0.95,
    tokens: ["order", "orders", "ordering", "purchase", "purchases"],
  },
  shopping_cart: {
    name: "Shopping cart",
    normalizedName: "shopping cart",
    type: "ui",
    importanceScore: 0.92,
    tokens: ["cart", "basket", "lineitem", "lineitems"],
  },
  product_catalog: {
    name: "Product catalog",
    normalizedName: "product catalog",
    type: "backend",
    importanceScore: 0.9,
    tokens: ["product", "products", "catalog", "sku", "category", "categories", "inventory", "listing", "listings"],
  },
  user_account: {
    name: "User account",
    normalizedName: "user account",
    type: "backend",
    importanceScore: 0.88,
    tokens: ["user", "users", "profile", "profiles", "account", "accounts", "membership", "onboarding"],
  },
  notifications: {
    name: "Notifications",
    normalizedName: "notifications",
    type: "service",
    importanceScore: 0.82,
    tokens: ["notification", "notifications", "notify", "email", "emails", "mail", "smtp", "sms", "push"],
  },
  search: {
    name: "Search",
    normalizedName: "search",
    type: "api",
    importanceScore: 0.84,
    tokens: ["search", "filter", "filters", "facet", "facets", "algolia", "elasticsearch"],
  },
  admin: {
    name: "Administration",
    normalizedName: "administration",
    type: "backend",
    importanceScore: 0.86,
    tokens: ["admin", "administrator", "moderation", "moderate"],
  },
  shipping: {
    name: "Shipping & delivery",
    normalizedName: "shipping delivery",
    type: "backend",
    importanceScore: 0.87,
    tokens: ["shipping", "shipment", "shipments", "delivery", "courier", "tracking", "logistics"],
  },
  reviews: {
    name: "Reviews & ratings",
    normalizedName: "reviews ratings",
    type: "ui",
    importanceScore: 0.8,
    tokens: ["review", "reviews", "rating", "ratings", "feedback"],
  },
  wishlist: {
    name: "Wishlist",
    normalizedName: "wishlist",
    type: "ui",
    importanceScore: 0.78,
    tokens: ["wishlist", "favorites", "favourite", "favourites"],
  },
  file_storage: {
    name: "File storage & uploads",
    normalizedName: "file storage uploads",
    type: "backend",
    importanceScore: 0.83,
    tokens: ["upload", "uploads", "storage", "blob", "attachment", "attachments", "download", "downloads"],
  },
  webhooks: {
    name: "Webhooks & integrations",
    normalizedName: "webhooks integrations",
    type: "api",
    importanceScore: 0.8,
    tokens: ["webhook", "webhooks", "integration", "integrations", "callback", "callbacks"],
  },
  analytics: {
    name: "Analytics",
    normalizedName: "analytics",
    type: "service",
    importanceScore: 0.75,
    tokens: ["analytics", "metrics", "telemetry", "tracking"],
  },
  reporting: {
    name: "Reporting & exports",
    normalizedName: "reporting exports",
    type: "backend",
    importanceScore: 0.76,
    tokens: ["report", "reports", "export", "exports", "csv", "xlsx"],
  },
  settings: {
    name: "Settings & preferences",
    normalizedName: "settings preferences",
    type: "ui",
    importanceScore: 0.72,
    tokens: ["settings", "preferences", "locale", "i18n", "localization"],
  },
};

/** Multi-word phrases (after normalizeSegment) → canonical key */
const PHRASE_TO_CANONICAL = {
  "sign in": "authentication",
  "sign up": "authentication",
  "shopping cart": "shopping_cart",
  "product catalog": "product_catalog",
  "user account": "user_account",
  "order creation": "orders",
  "file storage": "file_storage",
  "reviews ratings": "reviews",
  "shipping delivery": "shipping",
  "webhooks integrations": "webhooks",
  "reporting exports": "reporting",
  "settings preferences": "settings",
};

/** token → canonical key (built from CANONICAL_FEATURES; first writer wins for duplicates) */
const TOKEN_TO_CANONICAL = Object.create(null);
for (const [key, def] of Object.entries(CANONICAL_FEATURES)) {
  for (const t of def.tokens) {
    const k = t.toLowerCase();
    if (TOKEN_TO_CANONICAL[k] === undefined) TOKEN_TO_CANONICAL[k] = key;
  }
}

function basenameStem(filePath) {
  const base = String(filePath).split(/[/\\]/).pop() || "";
  return base.replace(/\.[a-zA-Z0-9]+$/, "");
}

export function isPresentationLayerPath(filePath) {
  const lower = String(filePath).toLowerCase().replace(/\\/g, "/");
  return /\/components\/|\/widgets\/|\/layouts\/|\/ui\/|\/design|\/atoms\/|\/molecules\/|\/primitives\/|\/stories\/|\/storybook\//.test(
    lower,
  );
}

export function isRouteHeavyPath(filePath) {
  const lower = String(filePath).toLowerCase().replace(/\\/g, "/");
  return (
    /\/api\/|\/routes\/|\/pages\/|(^|\/)app\/|(^|\/)src\/app\/|route\.|router\.|\.routes?\.|\/controllers\/|\/handlers\/|\/middleware\/|\/endpoints?\//.test(
      lower,
    ) || /(^|\/)api\./.test(lower)
  );
}

export function isBackendLayerPath(filePath) {
  const lower = String(filePath).toLowerCase().replace(/\\/g, "/");
  return /\/services\/|\/repositories\/|\/repos\/|\/domain\/|\/usecases\/|\/application\/|\/infrastructure\//.test(lower);
}

/**
 * Stems to scan for domain tokens (not every path segment).
 * @param {string} filePath
 * @returns {string[]}
 */
export function collectPathCandidates(filePath) {
  const lower = String(filePath).toLowerCase().replace(/\\/g, "/");
  const stems = new Set();
  const base = basenameStem(filePath);
  if (base) stems.add(base);

  if (isPresentationLayerPath(filePath)) {
    return [...stems];
  }

  if (isRouteHeavyPath(filePath)) {
    const parts = lower.split(/[/\\]+/);
    for (const p of parts) {
      const seg = p.replace(/\.[a-zA-Z0-9]+$/, "");
      if (!seg || NOISE_WORDS.has(seg)) continue;
      if (seg === "api" || /^v\d+$/.test(seg)) continue;
      stems.add(seg);
    }
    return [...stems];
  }

  if (isBackendLayerPath(filePath)) {
    const parts = filePath.split(/[/\\]+/).filter(Boolean);
    if (parts.length >= 2) {
      const parent = parts[parts.length - 2].replace(/\.[a-zA-Z0-9]+$/, "");
      const pl = parent.toLowerCase();
      if (parent && !NOISE_WORDS.has(pl)) stems.add(parent);
    }
    return [...stems];
  }

  /* Default: stem + parent folder (backend-style filenames) */
  const parts = filePath.split(/[/\\]+/).filter(Boolean);
  if (parts.length >= 2) {
    const parent = parts[parts.length - 2].replace(/\.[a-zA-Z0-9]+$/, "");
    const pl = parent.toLowerCase();
    if (parent && !NOISE_WORDS.has(pl)) stems.add(parent);
  }
  return [...stems];
}

/**
 * Resolve normalized phrase + tokens to canonical feature keys (deduped).
 * @param {string} normalizedPhrase from normalizeSegment(stem)
 * @returns {string[]}
 */
export function resolveCanonicalKeysFromPhrase(normalizedPhrase) {
  if (!normalizedPhrase || typeof normalizedPhrase !== "string") return [];
  const key = normalizedPhrase.trim().toLowerCase().replace(/\s+/g, " ");
  const out = [];
  const seen = new Set();

  const phraseCanon = PHRASE_TO_CANONICAL[key];
  if (phraseCanon && CANONICAL_FEATURES[phraseCanon]) {
    seen.add(phraseCanon);
    out.push(phraseCanon);
  }

  const tokens = key.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const ck = TOKEN_TO_CANONICAL[t];
    if (ck && CANONICAL_FEATURES[ck] && !seen.has(ck)) {
      seen.add(ck);
      out.push(ck);
    }
  }

  return out;
}

/**
 * All canonical keys hit by a file path (for one file).
 * @param {string} filePath
 * @returns {string[]}
 */
export function canonicalKeysForPath(filePath) {
  const keys = new Set();
  for (const stem of collectPathCandidates(filePath)) {
    const norm = normalizeSegment(stem);
    if (!norm) continue;
    for (const k of resolveCanonicalKeysFromPhrase(norm)) {
      keys.add(k);
    }
  }
  return [...keys];
}
