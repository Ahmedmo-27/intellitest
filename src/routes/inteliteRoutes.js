import { Router } from "express";
import * as controller from "../controllers/inteliteController.js";
import { validateProjectMap, validateAnalyzeFailure } from "../middleware/validateBody.js";

const router = Router();

router.post("/generate-testcases", validateProjectMap, controller.generateTestCases);
router.post("/generate-tests", validateProjectMap, controller.generateTests);
router.post("/analyze-failure", validateAnalyzeFailure, controller.analyzeFailure);

export default router;
