import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./utils/ticket-number.js";
import { Priority, TicketStatus } from "@prisma/client";

export const app = express();

app.use(cors());
app.use(express.json());

// Setup local uploads storage for attachments (BR-16)
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const safeOriginal = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeOriginal}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max (BR-07)
  },
});

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

/**
 * Validates that an ID is a strict positive integer (rejects 1.5, -1, NaN, non-integer strings)
 */
function isValidIntegerId(val: unknown): boolean {
  if (typeof val === "number") {
    return Number.isInteger(val) && val > 0;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    return /^[1-9]\d*$/.test(trimmed);
  }
  return false;
}

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

    if (!isValidIntegerId(categoryId)) {
      validationDetails.push("Category ID must be a valid positive integer.");
    }

    if (!isValidIntegerId(relatedSystemId)) {
      validationDetails.push("Related System ID must be a valid positive integer.");
    }

    if (!isValidIntegerId(requesterId)) {
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

    const parsedCategoryId = Number(categoryId);
    const parsedRelatedSystemId = Number(relatedSystemId);
    const parsedRequesterId = Number(requesterId);

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

    // BR-01 Concurrency-safe Ticket Number generation with optimistic retry loop & transaction advisory lock
    let retries = 5;
    let ticket = null;

    while (retries > 0) {
      try {
        ticket = await prisma.$transaction(async (tx) => {
          try {
            // PostgreSQL transaction-level advisory lock serializes ticket number allocation under parallel load
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_number_generation'))`;
          } catch {
            // Fallback gracefully if mock DB doesn't support pg_advisory_xact_lock
          }

          const ticketNumber = await generateTicketNumber(tx);

          return await tx.ticket.create({
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
        });

        break;
      } catch (err: any) {
        if (
          err?.code === "P2002" &&
          (err?.meta?.target?.includes("ticketNumber") || String(err?.message).includes("ticketNumber"))
        ) {
          retries--;
          if (retries === 0) throw err;
          // Jittered backoff before retrying ticket number allocation
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 25 + 10));
          continue;
        }
        throw err;
      }
    }

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

// GET /api/tickets — Retrieve paginated tickets owned by requester with search, filter, and sort (Section 3.5)
app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const {
      requesterId: requesterIdParam,
      search,
      category: categoryParam,
      priority,
      status,
      sort = "createdAt_desc",
      page: pageParam = "1",
      limit: limitParam = "10",
    } = req.query;

    if (!requesterIdParam) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "requesterId query parameter is required" },
      });
    }

    if (!isValidIntegerId(requesterIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "requesterId query parameter must be a valid positive integer" },
      });
    }

    const requesterId = Number(requesterIdParam);

    // Verify requester existence and active status (BR-04, BR-05)
    const requester = await prisma.requesterUser.findUnique({
      where: { id: requesterId },
    });

    if (!requester || !requester.isActive) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Requester is invalid, missing, or inactive" },
      });
    }

    // Validate page and limit
    if (!isValidIntegerId(pageParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "page parameter must be a valid positive integer" },
      });
    }

    if (!isValidIntegerId(limitParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "limit parameter must be a valid positive integer" },
      });
    }

    const page = Number(pageParam);
    const limit = Number(limitParam);

    if (limit > 50) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "limit parameter cannot exceed 50" },
      });
    }

    // Validate sort
    const validSorts = ["createdAt_desc", "createdAt_asc", "ticketNumber_asc", "ticketNumber_desc"];
    if (typeof sort !== "string" || !validSorts.includes(sort)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: `sort parameter must be one of: ${validSorts.join(", ")}` },
      });
    }

    // Build WHERE clause
    const where: any = {
      requesterId,
    };

    // Category filter
    if (categoryParam !== undefined && categoryParam !== "") {
      if (!isValidIntegerId(categoryParam)) {
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: "category parameter must be a valid positive integer" },
        });
      }
      where.categoryId = Number(categoryParam);
    }

    // Priority filter
    if (priority !== undefined && priority !== "") {
      const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
      if (typeof priority !== "string" || !validPriorities.includes(priority)) {
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: `priority parameter must be one of: ${validPriorities.join(", ")}` },
        });
      }
      where.requestedPriority = priority as Priority;
    }

    // Status filter
    if (status !== undefined && status !== "") {
      const validStatuses = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"];
      if (typeof status !== "string" || !validStatuses.includes(status)) {
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: `status parameter must be one of: ${validStatuses.join(", ")}` },
        });
      }
      where.status = status as TicketStatus;
    }

    // Search filter (summary or ticketNumber, case-insensitive)
    if (typeof search === "string" && search.trim().length > 0) {
      const trimmedSearch = search.trim();
      where.OR = [
        { summary: { contains: trimmedSearch, mode: "insensitive" } },
        { ticketNumber: { contains: trimmedSearch, mode: "insensitive" } },
      ];
    }

    // Sort order
    let orderBy: any = { createdAt: "desc" };
    if (sort === "createdAt_asc") orderBy = { createdAt: "asc" };
    else if (sort === "ticketNumber_asc") orderBy = { ticketNumber: "asc" };
    else if (sort === "ticketNumber_desc") orderBy = { ticketNumber: "desc" };

    // Query total count and paginated records
    const [totalItems, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          ticketNumber: true,
          createdAt: true,
          summary: true,
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          requestedPriority: true,
          itPriority: true,
          status: true,
          updatedAt: true,
          attachments: {
            where: { isRemoved: false },
            select: { id: true },
          },
        },
      }),
    ]);

    const formattedTickets = tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      createdAt: t.createdAt.toISOString(),
      summary: t.summary,
      category: t.category,
      relatedSystem: t.relatedSystem,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority,
      status: t.status,
      updatedAt: t.updatedAt.toISOString(),
      attachmentCount: t.attachments.length,
    }));

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return res.status(200).json({
      tickets: formattedTickets,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    });
  } catch {
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to query ticket list" },
    });
  }
});

// GET /api/tickets/:id — Single Ticket Details (FR-11, BR-05, BR-15)
app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketIdParam = req.params.id;
    const requesterIdParam = req.query.requesterId;

    if (!isValidIntegerId(ticketIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Ticket ID parameter must be a valid positive integer" },
      });
    }

    if (!isValidIntegerId(requesterIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "requesterId query parameter must be a valid positive integer" },
      });
    }

    const ticketId = Number(ticketIdParam);
    const requesterId = Number(requesterIdParam);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: {
          select: { id: true, name: true, email: true, department: true },
        },
        category: {
          select: { id: true, name: true },
        },
        relatedSystem: {
          select: { id: true, name: true },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            ticketId: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            fileSize: true,
            isRemoved: true,
            removalReason: true,
            removedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Ticket not found" },
      });
    }

    // BR-05 / AC-03 Requester ownership isolation check
    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Access denied: ticket is owned by another requester",
        },
      });
    }

    return res.status(200).json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      requesterId: ticket.requesterId,
      requester: ticket.requester,
      category: ticket.category,
      relatedSystem: ticket.relatedSystem,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      status: ticket.status,
      summary: ticket.summary,
      description: ticket.description,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      attachments: ticket.attachments.map((att) => ({
        id: att.id,
        ticketId: att.ticketId,
        fileName: att.fileName,
        originalName: att.originalName,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        isRemoved: att.isRemoved,
        removalReason: att.removalReason,
        removedAt: att.removedAt ? att.removedAt.toISOString() : null,
        createdAt: att.createdAt.toISOString(),
      })),
    });
  } catch {
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to retrieve ticket details" },
    });
  }
});

// POST /api/tickets/:id/attachments — Initial Attachment Upload (Step 2 of BR-16 / AC-15)
app.post("/api/tickets/:id/attachments", (req: Request, res: Response) => {
  upload.single("file")(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: "File size exceeds 5 MB limit" },
        });
      }
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: err.message || "Failed to process uploaded file" },
      });
    }

    try {
      const prisma = getPrisma();
      const ticketIdParam = req.params.id;
      const requesterIdParam = req.body.requesterId;

      if (!isValidIntegerId(ticketIdParam)) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch {}
        }
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: "Ticket ID parameter must be a valid positive integer" },
        });
      }

      if (!isValidIntegerId(requesterIdParam)) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch {}
        }
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: "requesterId must be a valid positive integer" },
        });
      }

      const ticketId = Number(ticketIdParam);
      const requesterId = Number(requesterIdParam);

      if (!req.file) {
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: "File attachment is required" },
        });
      }

      // BR-06 Allowed MIME types validation
      const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch {}
        }
        return res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: "Only image (JPEG, PNG, WebP) and PDF files are allowed",
          },
        });
      }

      // Check Ticket Existence
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch {}
        }
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Ticket not found" },
        });
      }

      // BR-05 Ownership isolation check
      if (ticket.requesterId !== requesterId) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch {}
        }
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Access denied: ticket is owned by another requester",
          },
        });
      }

      // BR-08 Enforce max 5 active attachments limit
      const activeCount = await prisma.attachment.count({
        where: { ticketId, isRemoved: false },
      });

      if (activeCount >= 5) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch {}
        }
        return res.status(400).json({
          error: {
            code: "ATTACHMENT_LIMIT_EXCEEDED",
            message: "Ticket already has the maximum of 5 active attachments",
          },
        });
      }

      // Save attachment in database
      const attachment = await prisma.attachment.create({
        data: {
          ticketId,
          fileName: req.file.filename,
          originalName: path.basename(req.file.originalname),
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          filePath: req.file.path,
        },
      });

      return res.status(201).json(attachment);
    } catch {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload attachment",
        },
      });
    }
  });
});

// GET /api/tickets/:id/attachments/:attachmentId — Stream/Download Active Attachment (BR-05, BR-09, AC-07)
app.get("/api/tickets/:id/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketIdParam = req.params.id;
    const attachmentIdParam = req.params.attachmentId;
    const requesterIdParam = req.query.requesterId;

    if (!isValidIntegerId(ticketIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Ticket ID parameter must be a valid positive integer" },
      });
    }

    if (!isValidIntegerId(attachmentIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Attachment ID parameter must be a valid positive integer" },
      });
    }

    if (!isValidIntegerId(requesterIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "requesterId query parameter must be a valid positive integer" },
      });
    }

    const ticketId = Number(ticketIdParam);
    const attachmentId = Number(attachmentIdParam);
    const requesterId = Number(requesterIdParam);

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

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId },
    });

    if (!attachment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Attachment not found" },
      });
    }

    // BR-09 / AC-07 Block download of soft-removed attachments
    if (attachment.isRemoved) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Cannot download a removed attachment",
        },
      });
    }

    if (!attachment.filePath || !fs.existsSync(attachment.filePath)) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "File not found on storage" },
      });
    }

    const safeFilename = attachment.originalName.replace(/"/g, '\\"');
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);

    const stream = fs.createReadStream(attachment.filePath);
    return stream.pipe(res);
  } catch {
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to stream attachment" },
    });
  }
});

// GET /api/tickets/:id/attachments/:attachmentId/metadata — Attachment JSON Metadata (Active & Removed)
app.get("/api/tickets/:id/attachments/:attachmentId/metadata", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketIdParam = req.params.id;
    const attachmentIdParam = req.params.attachmentId;
    const requesterIdParam = req.query.requesterId;

    if (!isValidIntegerId(ticketIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Ticket ID parameter must be a valid positive integer" },
      });
    }

    if (!isValidIntegerId(attachmentIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Attachment ID parameter must be a valid positive integer" },
      });
    }

    if (!isValidIntegerId(requesterIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "requesterId query parameter must be a valid positive integer" },
      });
    }

    const ticketId = Number(ticketIdParam);
    const attachmentId = Number(attachmentIdParam);
    const requesterId = Number(requesterIdParam);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Ticket not found" },
      });
    }

    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Access denied: ticket is owned by another requester",
        },
      });
    }

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId },
    });

    if (!attachment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Attachment not found" },
      });
    }

    return res.status(200).json({
      id: attachment.id,
      ticketId: attachment.ticketId,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      isRemoved: attachment.isRemoved,
      removalReason: attachment.removalReason,
      removedAt: attachment.removedAt ? attachment.removedAt.toISOString() : null,
      createdAt: attachment.createdAt.toISOString(),
    });
  } catch {
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to retrieve attachment metadata" },
    });
  }
});

// POST /api/tickets/:id/attachments/:attachmentId/remove — Soft-remove Attachment (BR-09, BR-10, AC-07, AC-08)
app.post("/api/tickets/:id/attachments/:attachmentId/remove", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketIdParam = req.params.id;
    const attachmentIdParam = req.params.attachmentId;
    const { requesterId: requesterIdParam, removalReason } = req.body;

    if (!isValidIntegerId(ticketIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Ticket ID parameter must be a valid positive integer" },
      });
    }

    if (!isValidIntegerId(attachmentIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Attachment ID parameter must be a valid positive integer" },
      });
    }

    if (!isValidIntegerId(requesterIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "requesterId must be a valid positive integer" },
      });
    }

    const trimmedReason = typeof removalReason === "string" ? removalReason.trim() : "";
    if (!trimmedReason || trimmedReason.length < 3) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Removal reason is required and must be at least 3 characters",
        },
      });
    }

    const ticketId = Number(ticketIdParam);
    const attachmentId = Number(attachmentIdParam);
    const requesterId = Number(requesterIdParam);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Ticket not found" },
      });
    }

    // BR-05 Ownership isolation
    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Access denied: ticket is owned by another requester",
        },
      });
    }

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId },
    });

    if (!attachment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Attachment not found" },
      });
    }

    if (attachment.isRemoved) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Attachment is already removed",
        },
      });
    }

    const updated = await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        isRemoved: true,
        removalReason: trimmedReason,
        removedAt: new Date(),
      },
    });

    return res.status(200).json({
      id: updated.id,
      ticketId: updated.ticketId,
      originalName: updated.originalName,
      isRemoved: updated.isRemoved,
      removalReason: updated.removalReason,
      removedAt: updated.removedAt ? updated.removedAt.toISOString() : null,
    });
  } catch {
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to execute attachment removal" },
    });
  }
});

// DELETE /api/tickets/:id — Compensation rollback for failed two-step creation (BR-16)
app.delete("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketIdParam = req.params.id;
    const requesterIdParam = req.query.requesterId;

    if (!isValidIntegerId(ticketIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Ticket ID parameter must be a valid positive integer" },
      });
    }

    if (!isValidIntegerId(requesterIdParam)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "requesterId query parameter must be a valid positive integer" },
      });
    }

    const ticketId = Number(ticketIdParam);
    const requesterId = Number(requesterIdParam);

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

    // Clean up physical files from disk under server/uploads/
    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      select: { filePath: true },
    });

    for (const att of attachments) {
      if (att.filePath && fs.existsSync(att.filePath)) {
        try {
          fs.unlinkSync(att.filePath);
        } catch {
          // ignore unlink error
        }
      }
    }

    // Delete ticket record (cascades to delete attachment records in DB)
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
