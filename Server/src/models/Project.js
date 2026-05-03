/**
 * Project model — one document per workspace.
 * projectId is a stable hash or UUID sent by the extension.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

const ProjectSchema = new Schema(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    name:      { type: String, required: true, trim: true },
    type:      { type: String, default: "unknown" },         // e.g. "web", "api", "cli"
    techStack: {
      language:  { type: String, default: "" },
      framework: { type: String, default: "" },
      extras:    [String],                                   // any other detected tools
    },
  },
  { timestamps: true }
);

export const Project = model("Project", ProjectSchema);
