/**
 * Lightweight JSON body validation for Intilitest endpoints.
 */

export function validateProjectMap(req, res, next) {
  const b = req.body;
  if (!b || typeof b !== "object") {
    return res.status(400).json({ error: "Body must be a JSON object (Project Map)." });
  }
  const required = ["type", "language", "framework"];
  for (const k of required) {
    if (b[k] == null || String(b[k]).trim() === "") {
      return res.status(400).json({ error: `Missing or empty required field: ${k}` });
    }
  }
  if (b.modules != null && !Array.isArray(b.modules)) {
    return res.status(400).json({ error: "Field 'modules' must be an array when provided." });
  }
  if (b.routes != null && !Array.isArray(b.routes)) {
    return res.status(400).json({ error: "Field 'routes' must be an array when provided." });
  }
  req.projectMap = {
    type: String(b.type),
    language: String(b.language),
    framework: String(b.framework),
    modules: Array.isArray(b.modules) ? b.modules.map(String) : [],
    routes: Array.isArray(b.routes) ? b.routes.map(String) : [],
  };
  next();
}

export function validateAnalyzeFailure(req, res, next) {
  const b = req.body;
  if (!b || typeof b !== "object") {
    return res.status(400).json({ error: "Body must be a JSON object." });
  }
  if (b.error == null || String(b.error).trim() === "") {
    return res.status(400).json({ error: "Field 'error' is required." });
  }
  req.failurePayload = {
    error: String(b.error),
    test: b.test != null ? String(b.test) : "",
  };
  next();
}
