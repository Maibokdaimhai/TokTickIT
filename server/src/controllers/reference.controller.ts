import type { RequestHandler } from "express";
import * as service from "../services/reference.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const health: RequestHandler = (_req, res) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
};

export const listCategories = asyncHandler(async (_req, res) => {
  res.status(200).json(await service.listCategories());
}, "Failed to fetch categories");

export const listRelatedSystems = asyncHandler(async (_req, res) => {
  res.status(200).json(await service.listRelatedSystems());
}, "Failed to fetch related systems");
