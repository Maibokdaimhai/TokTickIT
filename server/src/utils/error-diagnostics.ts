import type { Request } from "express";
import type { ApiError } from "../errors/api-error.js";

const fileErrorCodes = new Set(["ENOENT", "EACCES", "EPERM", "EIO", "EISDIR", "EMFILE", "ENFILE", "ENOSPC"]);

/** Keep the original cause on the error, but log only allowlisted diagnostics. */
export function logServerError(req: Request, error: ApiError): void {
  const cause = error.cause instanceof Error ? error.cause : error;
  const code = "code" in cause ? cause.code : undefined;
  const safeCode = typeof code === "string" && (fileErrorCodes.has(code) || /^P\d{4}$/.test(code))
    ? code : undefined;

  // Remove the whole message, including any embedded newlines, before collecting frames.
  // Error messages may contain SQL, credentials, paths, or user-provided content.
  const header = `${cause.name}: ${cause.message}`;
  const trace = cause.stack?.startsWith(header) ? cause.stack.slice(header.length) : "";
  const frames = trace.split("\n").filter((line) => /^\s+at /.test(line)).slice(0, 12);

  console.error("Request failed", {
    method: req.method,
    route: typeof req.route?.path === "string" ? req.route.path : "<unmatched>",
    status: error.status,
    code: error.error.code,
    causeCode: safeCode,
    frames,
  });
}
