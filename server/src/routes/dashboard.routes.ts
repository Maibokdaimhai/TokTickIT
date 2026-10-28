import { Router } from "express";
import { requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requesterDashboard, staffDashboard, myActiveActions } from "../services/dashboard.service.js";

export const router = Router();
const staff = requireRoles("IT_STAFF", "ADMINISTRATOR");
router.get("/dashboards/requester", requireRoles("REQUESTER"), asyncHandler(async (req, res) => {
  res.json(await requesterDashboard(req.query, res.locals.user.id));
}, "Requester dashboard retrieval failed"));
router.get("/dashboards/staff", staff, asyncHandler(async (req, res) => {
  res.json(await staffDashboard(req.query, res.locals.user.id));
}, "Staff dashboard retrieval failed"));
router.get("/staff/actions", staff, asyncHandler(async (req, res) => {
  res.json(await myActiveActions(req.query, res.locals.user.id));
}, "Assigned actions retrieval failed"));
