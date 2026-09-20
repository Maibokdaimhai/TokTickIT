import { Router } from "express";
import * as controller from "../controllers/reference.controller.js";

export const router = Router();

router.get("/categories", controller.listCategories);
router.get("/related-systems", controller.listRelatedSystems);
