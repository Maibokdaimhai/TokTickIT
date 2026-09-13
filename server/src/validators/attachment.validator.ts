import { ApiError } from "../errors/api-error.js";
import type { UploadedFile } from "../storage/attachments.js";

export function validateUpload(file: UploadedFile | undefined): asserts file is UploadedFile {
  if (!file) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: "File attachment is required" });
  }
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new ApiError(400, {
      code: "BAD_REQUEST",
      message: "Only image (JPEG, PNG, WebP) and PDF files are allowed",
    });
  }
}

export function parseRemovalReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < 3) {
    throw new ApiError(400, {
      code: "BAD_REQUEST",
      message: "Removal reason is required and must be at least 3 characters",
    });
  }
  return reason;
}
