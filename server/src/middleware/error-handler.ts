import type { ErrorRequestHandler } from "express";
import { ApiError } from "../errors/api-error.js";
import { logServerError } from "../utils/error-diagnostics.js";
import { clearSessionCookie } from "../utils/session.js";
import { ThrottledError } from "../services/auth.service.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  // Parser failures must use safe JSON, never an Express development error page.
  if (!(error instanceof ApiError)) {
    if (error?.type === "entity.too.large" || error?.type === "entity.parse.failed") {
      res.status(error.type === "entity.too.large" ? 413 : 400).json({ error: { code: "BAD_REQUEST", message: "Invalid JSON request body" } });
      return;
    }
    next(error);
    return;
  }
  if (error.status >= 500) logServerError(req, error);
  if (error.status === 401) clearSessionCookie(res);
  if (error instanceof ThrottledError) res.setHeader("Retry-After", error.retryAfter);
  if (res.headersSent) {
    // A partially transferred file cannot be replaced with an HTTP/JSON error.
    res.destroy();
    return;
  }
  res.removeHeader("Content-Disposition");
  res.removeHeader("Content-Length");
  res.status(error.status).type("application/json").json({ error: error.error });
};
