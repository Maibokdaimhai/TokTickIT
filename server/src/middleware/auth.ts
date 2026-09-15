import type { RequestHandler } from "express";
import type { UserRole } from "@prisma/client";
import { asyncHandler } from "./async-handler.js";
import { currentSession, safeUser } from "../services/auth.service.js";
import { ApiError } from "../errors/api-error.js";
import { readSessionToken } from "../utils/session.js";

export const requireSession: RequestHandler = (req, res, next) => {
  // Use the async error adapter only for errors; successful middleware continues normally.
  void currentSession(readSessionToken(req)).then(session => {
    res.locals.user = safeUser(session.user);
    if (session.user.mustChangePassword) throw new ApiError(403, { code: "PASSWORD_CHANGE_REQUIRED", message: "Change your initial password to continue" });
    next();
  }).catch(error => asyncHandler(async () => { throw error; }, "Unable to verify session")(req, res, next));
};

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (_req, res, next) => {
    if (!res.locals.user || !roles.includes(res.locals.user.role)) return next(new ApiError(403, { code: "FORBIDDEN", message: "Access denied" }));
    next();
  };
}

export const requireOrigin: RequestHandler = (req, _res, next) => {
  if (["POST", "PATCH", "DELETE", "PUT"].includes(req.method) && req.get("Origin") !== (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")) {
    next(new ApiError(403, { code: "ORIGIN_FORBIDDEN", message: "Request origin is not allowed" }));
    return;
  }
  next();
};
