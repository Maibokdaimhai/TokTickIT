import { test, expect } from "@playwright/test";
import { validateDatabaseUrl } from "./db-guard.js";
import {
  createAccount,
  createTicketFixture,
  cleanAccounts,
  database,
} from "./helpers.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

test.describe("Safety Guard & Cleanup Deterministic Verification", () => {
  test("Requirement 1: Disposable-database safety guard rejects dev DB and validates correctly", () => {
    // NOTE: The following URLs are intentionally synthetic unit test fixtures used to verify
    // URL pathname extraction and safety guard behavior; they contain no operational credentials.
    // 1. Dev DB with 'test' only in the password must be rejected
    const devDbWithTestInPassword = "postgresql://toktickit:testpassword123@localhost:5432/toktickit";
    const devResult = validateDatabaseUrl(devDbWithTestInPassword, "1");
    expect(devResult.valid).toBe(false);
    expect(devResult.error).toContain("Refusing to run tests against the development database 'toktickit'");

    // Dev DB with 'e2e' only in username or query param
    const devDbWithE2eInUser = "postgresql://e2e_user:secret@localhost:5432/toktickit?flag=e2e";
    const devUserResult = validateDatabaseUrl(devDbWithE2eInUser, "1");
    expect(devUserResult.valid).toBe(false);
    expect(devUserResult.error).toContain("Refusing to run tests against the development database 'toktickit'");

    // 2. Disposable DB name must be accepted
    const disposableDb = "postgresql://user:pass@localhost:5432/toktickit_lab3_e2e_20260918";
    const dispResult = validateDatabaseUrl(disposableDb, "1");
    expect(dispResult.valid).toBe(true);
    expect(dispResult.dbName).toBe("toktickit_lab3_e2e_20260918");

    const testDb = "postgresql://user:pass@localhost:5432/toktickit_test_disposable";
    const testResult = validateDatabaseUrl(testDb, "1");
    expect(testResult.valid).toBe(true);
    expect(testResult.dbName).toBe("toktickit_test_disposable");

    // 3. Missing/malformed URL must be rejected safely
    expect(validateDatabaseUrl("", "1").valid).toBe(false);
    expect(validateDatabaseUrl(undefined, "1").valid).toBe(false);
    expect(validateDatabaseUrl("not-a-valid-url", "1").valid).toBe(false);
    expect(validateDatabaseUrl("postgresql://localhost:5432", "1").valid).toBe(false);
    expect(validateDatabaseUrl("postgresql://localhost:5432/", "1").valid).toBe(false);

    // 4. E2E_ALLOW_DB_WRITE requirement
    expect(validateDatabaseUrl(disposableDb, "0").valid).toBe(false);
    expect(validateDatabaseUrl(disposableDb, undefined).valid).toBe(false);
  });

  test("Requirement 2: Complete fixture cleanup leaves zero orphaned records or references", async () => {
    const db = database();
    const seededRequester = await db.user.findFirstOrThrow({
      where: { seedKey: { not: null }, role: "REQUESTER" },
    });

    // 1. Create a tracked Staff user who owns a ticket submitted by seeded Requester
    const staffUser = await createAccount("Regression Staff Owner", { role: "IT_STAFF" });
    const seededTicket = await db.ticket.findFirstOrThrow({
      where: { seedKey: { not: null }, requesterId: seededRequester.id },
    });
    // Assign staffUser as owner of the seeded ticket
    await db.ticket.update({
      where: { id: seededTicket.id },
      data: { ownerId: staffUser.id },
    });

    // 2. Create a tracked Requester referenced by problemAppearsResolvedById
    const resolverRequester = await createAccount("Regression Resolver Requester", { role: "REQUESTER" });
    await db.ticket.update({
      where: { id: seededTicket.id },
      data: {
        problemAppearsResolvedAt: new Date(),
        problemAppearsResolvedById: resolverRequester.id,
      },
    });

    // 3. Create an account simulating one created through the Administrator UI (@e2e.example, not in ids array)
    const adminCreatedEmail = `admin-created-${randomUUID()}@e2e.example`;
    const adminCreatedUser = await db.user.create({
      data: {
        name: "Admin Created Test User",
        email: adminCreatedEmail,
        passwordHash: "$2b$12$e2eHashedPasswordDummyValuePlaceholderOnly999",
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: true,
      },
    });

    // 4. Create an E2E ticket with an attachment, comment, note, and session
    const e2eTicket = await createTicketFixture({
      requesterId: staffUser.id,
      summary: "[E2E-CLEANUP-TEST] Temporary Ticket for Verification",
      status: "OPEN",
    });

    // Add session
    await db.session.create({
      data: {
        tokenDigest: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""),
        userId: staffUser.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Add public comment and internal note
    await db.publicComment.create({
      data: {
        ticketId: e2eTicket.id,
        authorId: staffUser.id,
        content: "Cleanup test public comment",
      },
    });
    await db.internalNote.create({
      data: {
        ticketId: e2eTicket.id,
        authorId: staffUser.id,
        content: "Cleanup test internal note",
      },
    });

    // Add attachment with mock file on disk
    const mockUploadPath = path.resolve(process.cwd(), `artifacts/lab-03/scratch/uploads/cleanup-test-${randomUUID()}.txt`);
    await fs.mkdir(path.dirname(mockUploadPath), { recursive: true });
    await fs.writeFile(mockUploadPath, "mock upload data");
    await db.attachment.create({
      data: {
        ticketId: e2eTicket.id,
        fileName: "cleanup-test.txt",
        originalName: "cleanup-test.txt",
        mimeType: "text/plain",
        fileSize: 16,
        filePath: mockUploadPath,
      },
    });

    // 5. Run cleanAccounts()
    await cleanAccounts();

    // 6. Assertions:
    // - Seeded ticket is retained, but its ownerId and problemAppearsResolvedById were safely cleared
    const checkSeeded = await db.ticket.findUnique({ where: { id: seededTicket.id } });
    expect(checkSeeded).not.toBeNull();
    expect(checkSeeded?.ownerId).toBeNull();
    expect(checkSeeded?.problemAppearsResolvedById).toBeNull();

    // - Test users are completely deleted
    const staffCheck = await db.user.findUnique({ where: { id: staffUser.id } });
    expect(staffCheck).toBeNull();
    const resolverCheck = await db.user.findUnique({ where: { id: resolverRequester.id } });
    expect(resolverCheck).toBeNull();
    const adminCreatedCheck = await db.user.findUnique({ where: { id: adminCreatedUser.id } });
    expect(adminCreatedCheck).toBeNull();

    // - E2E ticket and attachments/comments/notes/sessions are completely deleted
    const ticketCheck = await db.ticket.findUnique({ where: { id: e2eTicket.id } });
    expect(ticketCheck).toBeNull();
    const commentCheck = await db.publicComment.findMany({ where: { ticketId: e2eTicket.id } });
    expect(commentCheck).toHaveLength(0);
    const noteCheck = await db.internalNote.findMany({ where: { ticketId: e2eTicket.id } });
    expect(noteCheck).toHaveLength(0);
    const sessionCheck = await db.session.findMany({ where: { userId: staffUser.id } });
    expect(sessionCheck).toHaveLength(0);

    // - Mock file deleted from disk
    const fileExists = await fs.access(mockUploadPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(false);

    // - No orphan @e2e.example users remain in the DB
    const leftoverE2eUsers = await db.user.findMany({
      where: { email: { endsWith: "@e2e.example" } },
    });
    expect(leftoverE2eUsers).toHaveLength(0);
  });
});
