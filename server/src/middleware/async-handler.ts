import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "../errors/api-error.js";

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Express 4 does not forward rejected async handlers to error middleware. */
export function asyncHandler(controller: AsyncController, failureMessage: string): RequestHandler {
  return (req, res, next) => {
    const forward: NextFunction = (error) => next(
      error instanceof ApiError ? error : new ApiError(500, {
        code: "INTERNAL_SERVER_ERROR",
        message: failureMessage,
      }),
    );
    void Promise.resolve().then(() => controller(req, res, forward)).catch(forward);
  };
}
