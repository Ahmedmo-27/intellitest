import express from "express";
import cors from "cors";
import inteliteRoutes from "./routes/inteliteRoutes.js";
import { logger } from "./utils/logger.js";
import { rateLimiter } from "./middleware/rateLimiter.js";

/**
 * Express application factory — no listen() here (see server.js).
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  // ── Global middleware ──────────────────────────────────────────────────────
  // Rate limiter applied to all routes except /health
  app.use((req, res, next) => {
    if (req.path === "/health") return next();
    return rateLimiter(req, res, next);
  });

  // ── Health check ───────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "intellitest-backend" });
  });

  // ── API routes ─────────────────────────────────────────────────────────────
  app.use("/", inteliteRoutes);

  // ── 404 ────────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      source: "backend",
      type: "NotFound",
      message: "The requested endpoint does not exist.",
    });
  });

  // ── Central error handler (sync throws / unhandled next(err)) ─────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error("unhandled_error", { message: err.message, stack: err.stack?.slice(0, 400) });
    res.status(500).json({
      source: "backend",
      type: "InternalError",
      message: "Internal server error. Please try again.",
    });
  });

  return app;
}
