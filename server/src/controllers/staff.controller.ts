import * as service from "../services/staff.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const listStaffTickets = asyncHandler(async (req, res) => {
  res.status(200).json(await service.listStaffTickets(req.query, res.locals.user.id));
}, "Failed to query staff ticket queue");

export const getEligibleOwners = asyncHandler(async (req, res) => {
  res.status(200).json(await service.getEligibleOwners(req.query));
}, "Failed to retrieve eligible owners");

export const getStaffTicketDetail = asyncHandler(async (req, res) => {
  res.status(200).json(await service.getStaffTicketDetail(req.params.id, res.locals.user));
}, "Failed to retrieve staff ticket detail");

export const claimTicket = asyncHandler(async (req, res) => {
  res.status(200).json(await service.claimTicket(req.params.id, req.body, res.locals.user));
}, "Failed to claim ticket");

export const updateOwner = asyncHandler(async (req, res) => {
  res.status(200).json(await service.updateOwner(req.params.id, req.body, res.locals.user));
}, "Failed to update ticket owner");

export const updateItPriority = asyncHandler(async (req, res) => {
  res.status(200).json(await service.updateItPriority(req.params.id, req.body, res.locals.user));
}, "Failed to update IT priority");

export const updateStatus = asyncHandler(async (req, res) => {
  res.status(200).json(await service.updateStatus(req.params.id, req.body, res.locals.user));
}, "Failed to update ticket status");
