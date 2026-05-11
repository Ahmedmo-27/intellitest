import mongoose from "mongoose";

const FeatureRelationshipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    /** Canonical feature labels (normalized phrases), matches Feature.normalizedName */
    source: { type: String, required: true },
    target: { type: String, required: true },

    type: {
      type: String,
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
      required: true,
    },

    projectId: { type: String, required: true, index: true },

    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    evidence: [{ type: String }],
    files: [{ type: String }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

FeatureRelationshipSchema.index(
  { userId: 1, source: 1, target: 1, type: 1, projectId: 1 },
  { unique: true },
);
FeatureRelationshipSchema.index({ userId: 1, projectId: 1, target: 1 });
FeatureRelationshipSchema.index({ userId: 1, projectId: 1, confidence: -1 });

export const FeatureRelationship = mongoose.model("FeatureRelationship", FeatureRelationshipSchema);
export default FeatureRelationship;
