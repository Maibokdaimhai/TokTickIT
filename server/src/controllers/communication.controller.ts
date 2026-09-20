import type { Request, Response } from "express";
import * as service from "../services/communication.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const getPublicComments = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPublicComments(req.params.id, res.locals.user);
  res.json(result);
}, "Public comments retrieval failed");

export const postPublicComment = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.createPublicComment(req.params.id, req.body, res.locals.user);
  res.status(201).json(result);
}, "Public comment creation failed");

export const getInternalNotes = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listInternalNotes(req.params.id, res.locals.user);
  res.json(result);
}, "Internal notes retrieval failed");

export const postInternalNote = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.createInternalNote(req.params.id, req.body, res.locals.user);
  res.status(201).json(result);
}, "Internal note creation failed");

export const postProblemAppearsResolved = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.indicateProblemAppearsResolved(req.params.id, req.body, res.locals.user);
  res.status(200).json(result);
}, "Problem appears resolved indication failed");
