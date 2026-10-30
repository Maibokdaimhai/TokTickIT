import { Router } from "express";
import * as controller from "../controllers/action.controller.js";
import { requireRoles } from "../middleware/auth.js";

export const router = Router();
const readers = requireRoles("REQUESTER", "IT_STAFF", "ADMINISTRATOR");
const writers = requireRoles("IT_STAFF", "ADMINISTRATOR");
router.get("/tickets/:id/actions", readers, controller.list);
router.get("/tickets/:id/actions/:actionId", readers, controller.get);
router.get("/tickets/:id/actions/:actionId/revisions", readers, controller.revisions);
router.post("/staff/tickets/:id/actions", writers, controller.create);
router.patch("/staff/tickets/:id/actions/:actionId", writers, controller.update);
router.post("/staff/tickets/:id/actions/:actionId/follow-up-completion", writers, controller.completeFollowUp);
