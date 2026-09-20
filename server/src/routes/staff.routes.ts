import { Router } from "express";
import * as controller from "../controllers/staff.controller.js";
import { requireRoles } from "../middleware/auth.js";

export const router = Router();

router.get("/staff/tickets", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.listStaffTickets);
router.get("/staff/eligible-owners", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.getEligibleOwners);
router.get("/staff/tickets/:id", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.getStaffTicketDetail);
router.post("/staff/tickets/:id/claim", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.claimTicket);
router.patch("/staff/tickets/:id/owner", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.updateOwner);
router.patch("/staff/tickets/:id/it-priority", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.updateItPriority);
router.patch("/staff/tickets/:id/status", requireRoles("IT_STAFF", "ADMINISTRATOR"), controller.updateStatus);
