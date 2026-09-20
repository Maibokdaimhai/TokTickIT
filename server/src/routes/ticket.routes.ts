import { Router } from "express";
import * as controller from "../controllers/ticket.controller.js";
import { requireRoles } from "../middleware/auth.js";

export const router = Router();

router.post("/tickets", requireRoles("REQUESTER"), controller.createTicket);
router.get("/tickets", requireRoles("REQUESTER"), controller.listTickets);
router.get("/tickets/:id", requireRoles("REQUESTER"), controller.getTicket);
router.delete("/tickets/:id", requireRoles("REQUESTER"), controller.rollbackTicket);
