/**
 * Feature model — detected software features and their testing health scores.
 * Upserted per-project as new test generations come in.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

const FeatureSchema = new Schema(
  {
    projectId:   { type: String, required: true, index: true },
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // 0–100 rolling score (updated after each AI generation)
    testScore: { type: Number, min: 0, max: 100, default: 0 },

    metrics: {
      totalTests:  { type: Number, default: 0 },
      passedTests: { type: Number, default: 0 },
      failedTests: { type: Number, default: 0 },
      coverage:    { type: Number, min: 0, max: 100, default: 0 },
    },
  },
  { timestamps: true }
);

FeatureSchema.index({ projectId: 1, name: 1 }, { unique: true });

export const Feature = model("Feature", FeatureSchema);
