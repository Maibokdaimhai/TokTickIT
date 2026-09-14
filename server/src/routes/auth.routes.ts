import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";

export const router = Router();
router.post("/login", auth.login);
router.post("/logout", auth.logout);
router.get("/me", auth.me);
router.post("/change-password", auth.changePassword);
