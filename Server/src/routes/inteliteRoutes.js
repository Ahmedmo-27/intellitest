import { Router } from "express";
import * as controller from "../controllers/inteliteController.js";
import { validateProjectMap, validateAnalyzeFailure } from "../middleware/validateBody.js";
import { promptFilter } from "../middleware/promptFilter.js";

const router = Router();

// Project-map endpoints share: schema validation → prompt quality filter → controller
router.post(
  "/generate-testcases",
  validateProjectMap,
  promptFilter,
  controller.generateTestCases
);

router.post(
  "/generate-tests",
  validateProjectMap,
  promptFilter,
  controller.generateTests
);

// Failure analysis: only schema validation (no free-text prompt involved)
router.post(
  "/analyze-failure",
  validateAnalyzeFailure,
  controller.analyzeFailure
);

export default router;
