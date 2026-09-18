import { ApiError } from "../errors/api-error.js";
import { parseExpectedVersion } from "./id.validator.js";

function ensureObjectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length === 0) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Request body must be a non-empty object" });
  }
  return body as Record<string, unknown>;
}

export function parseCreateCommunication(body: unknown): { content: string } {
  const obj = ensureObjectBody(body);
  const keys = Object.keys(obj);
  const permitted = new Set(["content"]);

  if (keys.some((k) => !permitted.has(k)) || !("content" in obj)) {
    throw new ApiError(400, {
      code: "VALIDATION_ERROR",
      message: "Request must only contain content",
    });
  }

  if (typeof obj.content !== "string") {
    throw new ApiError(400, {
      code: "VALIDATION_ERROR",
      message: "Content must be a string",
    });
  }

  const trimmed = obj.content.trim();
  const codePoints = Array.from(trimmed).length;

  if (codePoints < 1 || codePoints > 2000) {
    throw new ApiError(400, {
      code: "VALIDATION_ERROR",
      message: "Content is required and must be between 1 and 2000 characters",
    });
  }

  return { content: trimmed };
}

export function parseProblemAppearsResolved(body: unknown): { expectedVersion: number; comment?: string } {
  const obj = ensureObjectBody(body);
  const keys = Object.keys(obj);
  const permitted = new Set(["expectedVersion", "comment"]);

  if (keys.some((k) => !permitted.has(k)) || !("expectedVersion" in obj)) {
    throw new ApiError(400, {
      code: "VALIDATION_ERROR",
      message: "expectedVersion is required and no unknown fields are permitted",
    });
  }

  const expectedVersion = parseExpectedVersion(obj.expectedVersion);
  let comment: string | undefined;

  if ("comment" in obj && obj.comment !== undefined) {
    if (typeof obj.comment !== "string") {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "Comment must be a string",
      });
    }
    const trimmed = obj.comment.trim();
    if (trimmed.length === 0) {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "Comment cannot be whitespace-only",
      });
    }
    const codePoints = Array.from(trimmed).length;
    if (codePoints > 2000) {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "Comment must be between 1 and 2000 characters",
      });
    }
    comment = trimmed;
  }

  return { expectedVersion, comment };
}
