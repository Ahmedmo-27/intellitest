/**
 * app.js — Express application factory.
 *
 * Responsibility: wire middleware → routes → error handlers.
 * No business logic lives here.
 */

import express from "express";
import cors    from "cors";
import { server as serverConfig, cors as corsConfig } from "./config.js";
import inteliteRoutes from "./routes/inteliteRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { logger }     from "./utils/logger.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { authMiddleware, optionalAuthMiddleware } from "./middleware/authMiddleware.js";

// ── CORS ───────────────────────────────────────────────────────────────────────

function buildCorsOptions() {
  const origins = corsConfig.allowedOrigins;

  // "*" or empty → open (dev only; warn in production)
  if (origins === "*") {
    if (!serverConfig.isDev) {
      logger.warn("cors_open_in_production", {
        hint: "Set CORS_ALLOWED_ORIGINS to a comma-separated list of allowed origins.",
      });
    }
    return { origin: "*" };
  }

  const list = origins.split(",").map((o) => o.trim()).filter(Boolean);
  return {
    origin(requestOrigin, callback) {
      // Allow server-to-server (no Origin header) or explicit allowlist
      if (!requestOrigin || list.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${requestOrigin}' not allowed`));
      }
    },
  };
}

// ── App factory ────────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();

  // ── Request parsing ──────────────────────────────────────────────────────
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: "5mb" }));

  // ── Rate limiter (all routes except /health) ─────────────────────────────
  app.use((req, res, next) => {
    if (req.path === "/health") return next();
    return rateLimiter(req, res, next);
  });

// ── Health check ─────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "intellitest-backend", env: serverConfig.nodeEnv });
  });

  // ── LLM config — returns Groq credentials loaded from Server/.env ─────────
  // Used by the extension's "Generate Test Code" feature so it reads keys
  // from Server/.env (already loaded by dotenv) instead of the root .env.
  app.get("/llm-config", (_req, res) => {
    const apiKey = process.env.API_KEY?.trim() ?? '';
    const model  = process.env.API_MODEL?.trim() ?? 'llama-3.3-70b-versatile';
    const baseUrl = process.env.API_BASE_URL?.trim() ?? 'https://api.groq.com/openai/v1';
    if (!apiKey) {
      return res.status(500).json({ error: 'API_KEY is not set in Server/.env' });
    }
    return res.json({ apiKey, model, baseUrl });
  });

  // ── API routes ───────────────────────────────────────────────────────────
  app.use("/auth", authRoutes);
  // Use optional auth for public API routes so guests can access the service.
  app.use("/", optionalAuthMiddleware, inteliteRoutes);

  // ── 404 ──────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      source:  "backend",
      type:    "NotFound",
      message: "The requested endpoint does not exist.",
    });
  });

  // ── Central error handler ─────────────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error("unhandled_middleware_error", {
      message: err.message,
      stack:   err.stack?.slice(0, 400),
    });
    res.status(500).json({
      source:  "backend",
      type:    "InternalError",
      message: "Internal server error. Please try again.",
    });
  });

  return app;
}
