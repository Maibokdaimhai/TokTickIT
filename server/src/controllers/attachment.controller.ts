import * as service from "../services/attachment.service.js";
import { asyncHandler } from "../middleware/async-handler.js";
import fs from "fs";
import { formatContentDisposition } from "../utils/filename.js";

export const uploadAttachment = asyncHandler(async (req, res) => {
  res.status(201).json(await service.uploadAttachment({ ticketId: req.params.id }, req.body, res.locals.user.id, req.file));
}, "Failed to upload attachment");

export const downloadAttachment = asyncHandler(async (req, res, next) => {
  const attachment = await service.downloadAttachment({ ticketId: req.params.id, attachmentId: req.params.attachmentId }, res.locals.user, req.query);
  const disposition = formatContentDisposition("inline", attachment.originalName);
  const stream = fs.createReadStream(attachment.filePath);
  let failed = false;
  const fail = (error: unknown) => {
    if (failed) return;
    failed = true;
    stream.unpipe(res);
    stream.destroy();
    next(error);
  };
  stream.once("error", fail);
  stream.once("open", () => {
    if (failed || res.destroyed) {
      stream.destroy();
      return;
    }
    try {
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Disposition", disposition);
      stream.pipe(res);
    } catch (error) {
      fail(error);
    }
  });
  // Also release the file descriptor when a client abandons a download.
  res.once("close", () => stream.destroy());
}, "Failed to stream attachment");

export const getAttachmentMetadata = asyncHandler(async (req, res) => {
  res.status(200).json(await service.getAttachmentMetadata({ ticketId: req.params.id, attachmentId: req.params.attachmentId }, res.locals.user, req.query));
}, "Failed to retrieve attachment metadata");

export const removeAttachment = asyncHandler(async (req, res) => {
  res.status(200).json(await service.removeAttachment({ ticketId: req.params.id, attachmentId: req.params.attachmentId }, req.body, res.locals.user.id));
}, "Failed to execute attachment removal");
