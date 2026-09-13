import fs from "fs";
import path from "path";

// Keep the existing cwd-relative storage location for the Lab 2 API.
export const uploadDirectory = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

/** The subset of upload metadata required by application services. */
export type UploadedFile = {
  path: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
};

export function removeUploadedFile(filePath: string | undefined): void {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Preserve existing best-effort upload/compensation cleanup behavior.
    }
  }
}
