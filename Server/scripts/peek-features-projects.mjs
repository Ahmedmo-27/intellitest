/**
 * One-off diagnostics: compare Feature / Project collections to current schemas.
 * Run: node scripts/peek-features-projects.mjs  (from Server/, with .env loaded)
 */
import mongoose from "mongoose";
import { db } from "../src/config.js";
import { Feature } from "../src/models/Feature.js";
import { Project } from "../src/models/Project.js";

await mongoose.connect(db.uri);

const featureCount = await Feature.countDocuments();
const projectCount = await Project.countDocuments();

const featuresWithUserId = await Feature.countDocuments({
  userId: { $exists: true, $ne: null },
});
const featuresWithNormalizedName = await Feature.countDocuments({
  normalizedName: { $exists: true },
});

const projectsWithUserId = await Project.countDocuments({
  userId: { $exists: true, $ne: null },
});

const legacyFeature = await Feature.findOne({
  normalizedName: { $exists: false },
}).lean();
const newShapeFeature = await Feature.findOne({
  normalizedName: { $exists: true },
}).lean();

const projectSample = await Project.findOne().lean();
const projectWithUser = await Project.findOne({
  userId: { $exists: true, $ne: null },
}).lean();

console.log(
  JSON.stringify(
    {
      counts: { features: featureCount, projects: projectCount },
      features: {
        withUserId: featuresWithUserId,
        withNormalizedName: featuresWithNormalizedName,
      },
      projects: { withUserId: projectsWithUserId },
    },
    null,
    2,
  ),
);

console.log("\nlegacy_feature_sample (no normalizedName):");
console.log(legacyFeature ? Object.keys(legacyFeature).sort() : "(none)");

console.log("\nnew_shape_feature_sample:");
console.log(newShapeFeature ? Object.keys(newShapeFeature).sort() : "(none)");

console.log("\nproject_any:");
console.log(projectSample ? Object.keys(projectSample).sort() : "(none)");

console.log("\nproject_with_userId:");
console.log(projectWithUser ? Object.keys(projectWithUser).sort() : "(none)");

await mongoose.disconnect();
