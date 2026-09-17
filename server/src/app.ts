import "./config.js";
import express from "express";
import cors from "cors";
import { router as referenceRoutes } from "./routes/reference.routes.js";
import { router as ticketRoutes } from "./routes/ticket.routes.js";
import { router as attachmentRoutes } from "./routes/attachment.routes.js";
import { router as staffRoutes } from "./routes/staff.routes.js";
import { router as communicationRoutes } from "./routes/communication.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { router as authRoutes } from "./routes/auth.routes.js";
import { requireOrigin, requireSession } from "./middleware/auth.js";
import { health } from "./controllers/reference.controller.js";

// Retain the existing import surface for callers and tests.
export { decodeFilename, formatContentDisposition } from "./utils/filename.js";

export const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
app.use(requireOrigin);
app.use(express.json({ limit: "64kb" }));
app.get("/api/health", health);
app.get("/api/requesters", (_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } }));
app.use("/api/auth", authRoutes);
app.use("/api", requireSession);
app.use("/api", referenceRoutes);
app.use("/api", ticketRoutes);
app.use("/api", attachmentRoutes);
app.use("/api", staffRoutes);
app.use("/api", communicationRoutes);
app.use(errorHandler);

export default app;
