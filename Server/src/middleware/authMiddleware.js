import { verifyToken } from "../utils/jwt.js";

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") {
    return res.status(401).json({
      source: "auth",
      type: "Unauthorized",
      message: "Missing Authorization header.",
    });
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      source: "auth",
      type: "Unauthorized",
      message: "Authorization header must be in the format: Bearer <token>.",
    });
  }

  try {
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({
        source: "auth",
        type: "Unauthorized",
        message: "Invalid authentication token.",
      });
    }

    req.user = { id: String(payload.userId) };
    req.userId = String(payload.userId);
    return next();
  } catch (err) {
    return res.status(401).json({
      source: "auth",
      type: "Unauthorized",
      message: "Invalid or expired token.",
    });
  }
}
