import * as service from "../services/ticket.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const createTicket = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createTicket(req.body, res.locals.user.id));
}, "Failed to create support ticket");

export const listTickets = asyncHandler(async (req, res) => {
  res.status(200).json(await service.listTickets(req.query, res.locals.user.id));
}, "Failed to query ticket list");

export const getTicket = asyncHandler(async (req, res) => {
  res.status(200).json(await service.getTicket({ ticketId: req.params.id }, res.locals.user.id, req.query));
}, "Failed to retrieve ticket details");

export const rollbackTicket = asyncHandler(async (req, res) => {
  res.status(200).json(await service.rollbackTicket({ ticketId: req.params.id }, res.locals.user.id, req.query));
}, "Failed to roll back draft ticket");
