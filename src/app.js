import express from "express";
import cors from "cors";
import inteliteRoutes from "./routes/inteliteRoutes.js";
import { logger } from "./utils/logger.js";

/**
 * Express application factory — no listen() here (see server.js).
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Health check for load balancers / extension connectivity checks
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "intilitest-backend" });
  });

  app.use("/", inteliteRoutes);

  // 404
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Central error handler (sync throws in middleware)
  app.use((err, _req, res, _next) => {
    logger.error("unhandled_error", { message: err.message });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
