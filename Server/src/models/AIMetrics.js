/**
 * AIMetrics model — lightweight per-request performance tracking.
 * Used for analytics dashboards and SLA monitoring.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

const AIMetricsSchema = new Schema(
  {
    projectId:    { type: String, required: true, index: true },
    generationId: { type: Schema.Types.ObjectId, ref: "AIGeneration", index: true },
    latencyMs:    { type: Number, required: true },
    retryCount:   { type: Number, default: 0 },
    // null means success
    errorType:    { type: String, default: null },
  },
  { timestamps: true }
);

export const AIMetrics = model("AIMetrics", AIMetricsSchema);
