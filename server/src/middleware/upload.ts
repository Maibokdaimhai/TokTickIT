import type { RequestHandler } from "express";
import multer from "multer";
import path from "path";
import { ApiError } from "../errors/api-error.js";
import { uploadDirectory } from "../storage/attachments.js";
import { decodeFilename } from "../utils/filename.js";

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDirectory),
    filename: (_req, file, cb) => {
      const safeOriginal = path.basename(decodeFilename(file.originalname)).replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeOriginal}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");

export const uploadAttachmentFile: RequestHandler = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
      ? "File size exceeds 5 MB limit"
      : error.message || "Failed to process uploaded file";
    next(new ApiError(400, { code: "BAD_REQUEST", message }));
  });
};
