import { Router } from "express";
import * as controller from "../controllers/staff.controller.js";
import { requireRoles } from "../middleware/auth.js";

export const router = Router();

router.get("/staff/tickets", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.listStaffTickets);
router.get("/staff/eligible-owners", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.getEligibleOwners);
