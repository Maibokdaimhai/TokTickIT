import * as service from "../services/staff.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const listStaffTickets = asyncHandler(async (req, res) => {
  res.status(200).json(await service.listStaffTickets(req.query, res.locals.user.id));
}, "Failed to query staff ticket queue");

export const getEligibleOwners = asyncHandler(async (req, res) => {
  res.status(200).json(await service.getEligibleOwners(req.query));
}, "Failed to retrieve eligible owners");
