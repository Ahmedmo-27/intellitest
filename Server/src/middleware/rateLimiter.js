/**
 * Sliding-window rate limiter (in-memory, no external deps).
 *
 * Each "window" tracks an array of timestamps. On every request we:
 *   1. Prune timestamps older than WINDOW_MS.
 *   2. If remaining count === 0 → 429.
 *   3. Otherwise record the timestamp and continue.
 *
 * Configured via environment variables:
 *   RATE_LIMIT_WINDOW_MS   — window size in ms (default 60 000 → 1 min)
 *   RATE_LIMIT_MAX         — max requests per window  (default 20)
 *
 * Key derived from: X-Forwarded-For header → socket remote address → "unknown".
 * For multi-process deployments replace the Map with Redis.
 */

import { logger } from "../utils/logger.js";

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 20;

/** @type {Map<string, number[]>} */
const store = new Map();

/**
 * Prune timestamps outside the current sliding window.
 * @param {number[]} timestamps
 * @param {number} now
 * @returns {number[]}
 */
function prune(timestamps, now) {
  const cutoff = now - WINDOW_MS;
  return timestamps.filter((t) => t > cutoff);
}

/**
 * Derive a stable key for the request.
 * @param {import("express").Request} req
 * @returns {string}
 */
function getKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Rate-limiter middleware factory.
 * @param {{ windowMs?: number, max?: number }} [options]
 * @returns {import("express").RequestHandler}
 */
export function createRateLimiter({ windowMs = WINDOW_MS, max = MAX_REQUESTS } = {}) {
  return function rateLimiter(req, res, next) {
    const key = getKey(req);
    const now = Date.now();

    const raw = store.get(key) ?? [];
    const timestamps = prune(raw, now);

    const remaining = max - timestamps.length;

    // Always set informational headers
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, remaining - 1));
    res.setHeader("X-RateLimit-Window-Ms", windowMs);

    if (remaining <= 0) {
      const oldest = timestamps[0];
      const resetAt = new Date(oldest + windowMs).toISOString();
      res.setHeader("Retry-After", Math.ceil((oldest + windowMs - now) / 1000));
      logger.warn("rate_limit_exceeded", { key, count: timestamps.length, max });
      return res.status(429).json({
        source: "backend",
        type: "RateLimitExceeded",
        message: `Too many requests. You are allowed ${max} requests per ${windowMs / 1000}s window.`,
        retryAfter: resetAt,
      });
    }

    timestamps.push(now);
    store.set(key, timestamps);

    // Periodic housekeeping — clear keys with empty windows to prevent memory leaks
    if (Math.random() < 0.01) {
      const cutoff = now - windowMs;
      for (const [k, ts] of store.entries()) {
        if (ts.every((t) => t <= cutoff)) store.delete(k);
      }
    }

    next();
  };
}

/** Default export — ready-to-use instance with env-configured limits. */
export const rateLimiter = createRateLimiter();
