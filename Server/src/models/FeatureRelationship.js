/**
 * Feature relationship graph: compact hub storage (one document per source feature).
 * Collection: featurerelationships
 */

import mongoose from "mongoose";

const OutgoingEdgeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "depends_on",
        "triggers",
        "extends",
        "belongs_to",
        "ui_for",
        "uses",
        "validates",
        "updates",
        "reads_from",
        "writes_to",
      ],
    },
    target: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    evidence: [{ type: String }],
    files: [{ type: String }],
  },
  { _id: false },
);

const FeatureRelationshipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: String, required: true, index: true },

    /** Canonical feature name — all outgoing edges start here */
    hubFeature: { type: String, required: true },

    outgoing: { type: [OutgoingEdgeSchema], default: [] },

    aggregateFiles: [{ type: String }],
    summaryEvidence: [{ type: String }],
  },
  { timestamps: true },
);

FeatureRelationshipSchema.index({ userId: 1, projectId: 1, hubFeature: 1 }, { unique: true });
FeatureRelationshipSchema.index({ userId: 1, projectId: 1 });

export const FeatureRelationship = mongoose.model("FeatureRelationship", FeatureRelationshipSchema);
export default FeatureRelationship;
