/**
 * Context-Aware Guardrail System
 * Validates user prompt against project context to prevent AI hallucinations.
 */

/**
 * Validates whether a user prompt matches the actual project context
 * @param {string} prompt 
 * @param {object} context 
 * @returns {object} { matchType: "none" | "partial" | "strong", matchedFeatures: [], confidence: number }
 */
export function matchPromptToContext(prompt, context) {
  if (!prompt || typeof prompt !== "string") {
    // If no prompt, it's essentially an open generation based on context
    return { matchType: "strong", matchedFeatures: [], confidence: 100 };
  }

  const promptLower = prompt.toLowerCase();
  const matchedFeatures = [];
  let confidence = 0;

  // Extract features from context
  const modules = context.modules || [];
  const routes = context.routes || [];
  const codeInsights = context.codeInsights || {};
  const functions = codeInsights.functions || [];
  const variables = codeInsights.variables || [];
  const classes = codeInsights.classes || [];
  const priorityFiles = context.priorityFiles || [];

  // Helper to check and add match
  const checkMatch = (list, type) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const name = typeof item === "string" ? item : (item.name || "");
      if (name && promptLower.includes(name.toLowerCase())) {
        matchedFeatures.push({ type, name });
        confidence += 20; // weight per match
      }
    }
  };

  checkMatch(modules, "module");
  checkMatch(routes, "route");
  checkMatch(functions, "function");
  checkMatch(variables, "variable");
  checkMatch(classes, "class");
  checkMatch(priorityFiles, "file");

  // Deduplicate matched features
  const uniqueFeatures = [];
  const seen = new Set();
  for (const f of matchedFeatures) {
    const key = `${f.type}:${f.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFeatures.push(f);
    }
  }

  let matchType = "none";
  if (confidence > 0 && confidence < 40) {
    matchType = "partial";
  } else if (confidence >= 40) {
    matchType = "strong";
  }

  return {
    matchType,
    matchedFeatures: uniqueFeatures,
    confidence: Math.min(confidence, 100),
  };
}

/**
 * Validates the AI response to ensure it only includes known features
 * @param {object[]} testCases 
 * @param {object} context 
 * @returns {object} { isValid: boolean, unknownFeatures: string[] }
 */
export function validateResponseAgainstContext(testCases, context) {
  const allowedFeatures = new Set();
  const addAllowed = (list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const name = typeof item === "string" ? item : (item.name || "");
      if (name) allowedFeatures.add(name.toLowerCase());
    }
  };

  addAllowed(context.modules);
  addAllowed(context.routes);
  if (context.codeInsights) {
    addAllowed(context.codeInsights.functions);
    addAllowed(context.codeInsights.variables);
    addAllowed(context.codeInsights.classes);
  }

  // If we have no context, we can't restrict it
  if (allowedFeatures.size === 0) {
    return { isValid: true, unknownFeatures: [] };
  }

  const unknownFeatures = new Set();

  for (const tc of testCases) {
    // Check tags to ensure they map to known features (modules, routes, functions)
    const tags = Array.isArray(tc.tags) ? tc.tags : [];
    for (const tag of tags) {
      if (tag && typeof tag === "string") {
        // We allow generic tags like "auth", "api", "edge-case", but we try to validate 
        // if they are hallucinating specific module/function names
        const tagLower = tag.toLowerCase();
        const isGeneric = ["auth", "api", "ui", "edge-case", "happy-path", "error-handling"].includes(tagLower);
        
        if (!isGeneric && !allowedFeatures.has(tagLower)) {
          // This tag is not a generic tag and not found in our context
          unknownFeatures.add(tag);
        }
      }
    }
  }

  return {
    isValid: unknownFeatures.size === 0,
    unknownFeatures: Array.from(unknownFeatures)
  };
}
