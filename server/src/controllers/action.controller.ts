import * as service from "../services/action.service.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ApiError } from "../errors/api-error.js";

function noQuery(query: Record<string, unknown>) {
  if (Object.keys(query).length) throw new ApiError(400, { code: "BAD_REQUEST", message: "Invalid query parameters" });
}

export const list = asyncHandler(async (req, res) => { res.json(await service.listActions(req.params.id, req.query, res.locals.user)); }, "Actions retrieval failed");
export const get = asyncHandler(async (req, res) => { res.json(await service.getAction(req.params.id, req.params.actionId, req.query, res.locals.user)); }, "Action retrieval failed");
export const revisions = asyncHandler(async (req, res) => { res.json(await service.listRevisions(req.params.id, req.params.actionId, req.query, res.locals.user)); }, "Action history retrieval failed");
export const create = asyncHandler(async (req, res) => {
  noQuery(req.query);
  const result = await service.createAction(req.params.id, req.body, res.locals.user);
  res.status(result.replayed ? 200 : 201).json(result);
}, "Action creation failed");
export const update = asyncHandler(async (req, res) => {
  noQuery(req.query);
  res.json(await service.updateAction(req.params.id, req.params.actionId, req.body, res.locals.user));
}, "Action update failed");
export const completeFollowUp = asyncHandler(async (req, res) => {
  noQuery(req.query);
  res.json(await service.completeFollowUp(req.params.id, req.params.actionId, req.body, res.locals.user));
}, "Follow-up completion failed");
