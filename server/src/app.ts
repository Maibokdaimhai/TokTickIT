import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./utils/ticket-number.js";
import { Priority } from "@prisma/client";

export const app = express();

app.use(cors());
app.use(express.json());

// API Health Check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// GET /api/categories — Active IT request categories
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch {
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch categories",
      },
    });
  }
});

// GET /api/related-systems — Active IT related systems
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const systems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(systems);
  } catch {
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch related systems",
      },
    });
  }
});

// GET /api/requesters — Active Development Requesters for simulated login selection
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
      },
    });
    res.status(200).json(requesters);
  } catch {
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch active requesters",
      },
    });
  }
});

// POST /api/tickets — Create Ticket
app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const { requesterId, categoryId, relatedSystemId, summary, description, requestedPriority } = req.body;

    const validationDetails: string[] = [];

    // BR-11 Field Validation Constraints
    const trimmedSummary = typeof summary === "string" ? summary.trim() : "";
    if (!trimmedSummary || trimmedSummary.length < 5 || trimmedSummary.length > 150) {
      validationDetails.push("Summary is required and must be between 5 and 150 characters.");
    }

    const trimmedDescription = typeof description === "string" ? description.trim() : "";
    if (!trimmedDescription || trimmedDescription.length < 10 || trimmedDescription.length > 3000) {
      validationDetails.push("Description is required and must be between 10 and 3000 characters.");
    }

    const validPriorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT];
    if (!requestedPriority || !validPriorities.includes(requestedPriority as Priority)) {
      validationDetails.push("Requested Priority must be one of LOW, MEDIUM, HIGH, or URGENT.");
    }

    const parsedCategoryId = Number(categoryId);
    if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      validationDetails.push("Category ID must be a valid positive integer.");
    }

    const parsedRelatedSystemId = Number(relatedSystemId);
    if (isNaN(parsedRelatedSystemId) || parsedRelatedSystemId <= 0) {
      validationDetails.push("Related System ID must be a valid positive integer.");
    }

    const parsedRequesterId = Number(requesterId);
    if (isNaN(parsedRequesterId) || parsedRequesterId <= 0) {
      validationDetails.push("Requester ID must be a valid positive integer.");
    }

    if (validationDetails.length > 0) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Validation failed",
          details: validationDetails,
        },
      });
    }

    // BR-13 Check if Requester exists and is ACTIVE
    const requester = await prisma.requesterUser.findUnique({
      where: { id: parsedRequesterId },
    });

    if (!requester || !requester.isActive) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Requester account is inactive or not found",
        },
      });
    }

    // Check if Category exists & is active
    const category = await prisma.category.findUnique({
      where: { id: parsedCategoryId },
    });
    if (!category || !category.isActive) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Invalid or inactive Category selected",
        },
      });
    }

    // Check if Related System exists & is active
    const relatedSystem = await prisma.relatedSystem.findUnique({
      where: { id: parsedRelatedSystemId },
    });
    if (!relatedSystem || !relatedSystem.isActive) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Invalid or inactive Related System selected",
        },
      });
    }

    // BR-01 Generate Ticket Number (TKT-YYYY-XXXXXX)
    const ticketNumber = await generateTicketNumber(prisma);

    // Create Ticket record with initial status NEW (BR-02, BR-05)
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId: parsedRequesterId,
        categoryId: parsedCategoryId,
        relatedSystemId: parsedRelatedSystemId,
        summary: trimmedSummary,
        description: trimmedDescription,
        requestedPriority: requestedPriority as Priority,
        status: "NEW",
      },
      include: {
        requester: { select: { id: true, name: true, email: true, department: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json(ticket);
  } catch {
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create support ticket",
      },
    });
  }
});

// DELETE /api/tickets/:id — Compensation rollback for failed two-step creation (BR-16)
app.delete("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const requesterId = Number(req.query.requesterId);

    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Invalid Ticket ID parameter" },
      });
    }

    if (isNaN(requesterId) || requesterId <= 0) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "requesterId query parameter is required" },
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Ticket not found" },
      });
    }

    // BR-05 Ownership isolation check
    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Access denied: ticket is owned by another requester",
        },
      });
    }

    // Delete ticket record
    await prisma.ticket.delete({
      where: { id: ticketId },
    });

    return res.status(200).json({
      status: "ok",
      message: "Draft ticket rolled back successfully",
    });
  } catch {
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to roll back draft ticket",
      },
    });
  }
});

export default app;
