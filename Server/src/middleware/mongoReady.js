import mongoose from "mongoose";

/** Reject DB-backed routes immediately when Mongo is not connected (avoids Mongoose 10s buffer timeout). */
export function ensureMongoConnected(_req, res, next) {
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  return res.status(503).json({
    source: "backend",
    type: "ServiceUnavailable",
    message:
      "Database is not connected. Verify MONGODB_URI, that MongoDB / Atlas is reachable, and (for Atlas) that your IP is allowlisted.",
  });
}
