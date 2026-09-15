import express from "express";
import { router as referenceRouter } from "../src/routes/reference.routes.js";
import { router as ticketRouter } from "../src/routes/ticket.routes.js";
import { router as attachmentRouter } from "../src/routes/attachment.routes.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { health } from "../src/controllers/reference.controller.js";
// Isolate controller/stream error contracts from session/database availability.
const app = express();
app.use(express.json({ limit: "64kb" }));
app.get("/api/health", health);
app.use("/api", referenceRouter, ticketRouter, attachmentRouter);
app.use(errorHandler);
export default app;
