import express from "express";
import cors from "cors";
import { router as referenceRoutes } from "./routes/reference.routes.js";
import { router as ticketRoutes } from "./routes/ticket.routes.js";
import { router as attachmentRoutes } from "./routes/attachment.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

// Retain the existing import surface for callers and tests.
export { decodeFilename, formatContentDisposition } from "./utils/filename.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", referenceRoutes);
app.use("/api", ticketRoutes);
app.use("/api", attachmentRoutes);
app.use(errorHandler);

export default app;
