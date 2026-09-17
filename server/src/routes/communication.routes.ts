import { Router } from "express";
import * as controller from "../controllers/communication.controller.js";
import { requireRoles } from "../middleware/auth.js";

export const router = Router();

// Public Comments: accessible by owning requester, staff, and admin
router.get("/tickets/:id/public-comments", controller.getPublicComments);
router.post("/tickets/:id/public-comments", controller.postPublicComment);

// Internal Notes: staff and admin only; requester denied 403 before lookup
router.get("/staff/tickets/:id/internal-notes", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.getInternalNotes);
router.post("/staff/tickets/:id/internal-notes", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.postInternalNote);

// Problem Appears Resolved: requester only; staff and admin denied 403
router.post("/tickets/:id/problem-appears-resolved", requireRoles("REQUESTER"), controller.postProblemAppearsResolved);
