import type { ErrorRequestHandler } from "express";
import { ApiError } from "../errors/api-error.js";
import { logServerError } from "../utils/error-diagnostics.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  // Preserve Express handling of parser errors such as malformed JSON.
  if (!(error instanceof ApiError)) {
    next(error);
    return;
  }
  if (error.status >= 500) logServerError(req, error);
  if (res.headersSent) {
    // A partially transferred file cannot be replaced with an HTTP/JSON error.
    res.destroy();
    return;
  }
  res.removeHeader("Content-Disposition");
  res.removeHeader("Content-Length");
  res.status(error.status).type("application/json").json({ error: error.error });
};
