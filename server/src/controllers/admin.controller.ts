import type { Request, Response } from "express";
import * as adminService from "../services/admin.service.js";

export async function listUsers(req: Request, res: Response) {
  const result = await adminService.listUsers(req.query as Record<string, unknown>);
  res.json(result);
}

export async function createUser(req: Request, res: Response) {
  const result = await adminService.createUser(req.body);
  res.status(201).json(result);
}

export async function updateUser(req: Request, res: Response) {
  const result = await adminService.updateUser(req.params.id, req.body, res.locals.user);
  res.json(result);
}

export async function resetInitialPassword(req: Request, res: Response) {
  await adminService.resetInitialPassword(req.params.id, req.body);
  res.status(204).end();
}
