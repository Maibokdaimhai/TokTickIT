import { Router } from "express";
import * as controller from "../controllers/attachment.controller.js";
import { uploadAttachmentFile } from "../middleware/upload.js";
import { requireRoles } from "../middleware/auth.js";

export const router = Router();

router.post("/tickets/:id/attachments", requireRoles("REQUESTER"), uploadAttachmentFile, controller.uploadAttachment);
router.get("/tickets/:id/attachments/:attachmentId", requireRoles("REQUESTER", "IT_STAFF", "ADMINISTRATOR"), controller.downloadAttachment);
router.get("/tickets/:id/attachments/:attachmentId/metadata", requireRoles("REQUESTER", "IT_STAFF", "ADMINISTRATOR"), controller.getAttachmentMetadata);
router.post("/tickets/:id/attachments/:attachmentId/remove", requireRoles("REQUESTER"), controller.removeAttachment);
