import { Router } from "express";
import * as controller from "../controllers/ticket.controller.js";

export const router = Router();

router.post("/tickets", controller.createTicket);
router.get("/tickets", controller.listTickets);
router.get("/tickets/:id", controller.getTicket);
router.delete("/tickets/:id", controller.rollbackTicket);
