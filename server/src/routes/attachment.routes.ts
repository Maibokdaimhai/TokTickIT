import { Router } from "express";
import * as controller from "../controllers/attachment.controller.js";
import { uploadAttachmentFile } from "../middleware/upload.js";

export const router = Router();

router.post("/tickets/:id/attachments", uploadAttachmentFile, controller.uploadAttachment);
router.get("/tickets/:id/attachments/:attachmentId", controller.downloadAttachment);
router.get("/tickets/:id/attachments/:attachmentId/metadata", controller.getAttachmentMetadata);
router.post("/tickets/:id/attachments/:attachmentId/remove", controller.removeAttachment);
