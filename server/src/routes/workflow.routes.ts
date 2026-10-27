import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireRoles } from "../middleware/auth.js";
import { listStatusHistory } from "../services/workflow.service.js";

export const router = Router();
router.get("/tickets/:id/status-history", requireRoles("REQUESTER", "IT_STAFF", "ADMINISTRATOR"), asyncHandler(async (req, res) => {
  res.json(await listStatusHistory(req.params.id, req.query, res.locals.user));
}, "Ticket history retrieval failed"));
