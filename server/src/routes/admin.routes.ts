import { Router } from "express";
import * as controller from "../controllers/admin.controller.js";
import { requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const router = Router();

router.get("/admin/users", requireRoles("ADMINISTRATOR"), asyncHandler(controller.listUsers, "Unable to list users"));
router.post("/admin/users", requireRoles("ADMINISTRATOR"), asyncHandler(controller.createUser, "Unable to create user"));
router.patch("/admin/users/:id", requireRoles("ADMINISTRATOR"), asyncHandler(controller.updateUser, "Unable to update user"));
router.post("/admin/users/:id/initial-password", requireRoles("ADMINISTRATOR"), asyncHandler(controller.resetInitialPassword, "Unable to reset user password"));
