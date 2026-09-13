import type { ErrorRequestHandler } from "express";
import { ApiError } from "../errors/api-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  // Preserve Express handling of malformed JSON and errors after streaming began.
  if (res.headersSent || !(error instanceof ApiError)) {
    next(error);
    return;
  }
  res.status(error.status).json({ error: error.error });
};
