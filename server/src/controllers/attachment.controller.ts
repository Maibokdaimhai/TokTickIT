import * as service from "../services/attachment.service.js";
import { asyncHandler } from "../middleware/async-handler.js";
import fs from "fs";
import { formatContentDisposition } from "../utils/filename.js";

export const uploadAttachment = asyncHandler(async (req, res) => {
  res.status(201).json(await service.uploadAttachment({ ticketId: req.params.id }, req.body, req.file));
}, "Failed to upload attachment");

export const downloadAttachment = asyncHandler(async (req, res, next) => {
  const attachment = await service.downloadAttachment({ ticketId: req.params.id, attachmentId: req.params.attachmentId }, req.query);
  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("Content-Disposition", formatContentDisposition("inline", attachment.originalName));
  fs.createReadStream(attachment.filePath).on("error", (error) => next(error)).pipe(res);
}, "Failed to stream attachment");

export const getAttachmentMetadata = asyncHandler(async (req, res) => {
  res.status(200).json(await service.getAttachmentMetadata({ ticketId: req.params.id, attachmentId: req.params.attachmentId }, req.query));
}, "Failed to retrieve attachment metadata");

export const removeAttachment = asyncHandler(async (req, res) => {
  res.status(200).json(await service.removeAttachment({ ticketId: req.params.id, attachmentId: req.params.attachmentId }, req.body));
}, "Failed to execute attachment removal");
