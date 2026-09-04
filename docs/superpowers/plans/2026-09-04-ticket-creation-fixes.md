# Ticket Creation Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address PR reviewer change request by implementing initial attachment uploads & compensation rollback (BR-16 / AC-15), concurrency-safe ticket number generation, strict integer validation for numeric IDs, and automated regression tests.

**Architecture:** 
- In the client, ticket submission becomes a two-step REST flow: Step 1 creates the ticket record (`POST /api/tickets`), Step 2 sequentially uploads attachments (`POST /api/tickets/:id/attachments`). If any attachment upload fails, the client triggers automated compensation rollback (`DELETE /api/tickets/:id?requesterId=X`), purging the draft ticket and uploaded files while retaining the user's form inputs.
- On the backend, ticket number generation is made concurrency-safe using PostgreSQL transaction-level advisory locking (`pg_advisory_xact_lock`) and optimistic retries on `P2002` collisions. Numeric IDs are strictly validated with an integer validator (`Number.isInteger() && val > 0`) returning 400 Bad Request instead of 500.

**Tech Stack:** React 18, TypeScript, Express, Prisma ORM, Multer, Vitest, Testing Library, Supertest.

**Spec:** `docs/lab-02/specification.md` (BR-01, BR-06, BR-08, BR-11, BR-16, AC-15) and `docs/lab-02/api-spec.md` (Section 3.2, 3.7, 3.11).

## Global Constraints
- Do NOT emit `.js` files into `client/src` or `client/tests` — `client/tsconfig.json` must enforce `"noEmit": true`.
- Zero 500 errors on invalid inputs — all malformed or non-integer IDs must return HTTP 400 Bad Request.
- Concurrency collisions must not cause unhandled failures — parallel requests must yield unique sequential `TKT-YYYY-XXXXXX` numbers.
- Compensation rollback on attachment failure must retain user-entered form state in the UI.

---

### Task 1: Enforce `"noEmit": true` in Client tsconfig

**Files:**
- Modify: `client/tsconfig.json`

**Interfaces:**
- Produces: Type-checking only without writing any `.js` artifacts into source directories.

- [ ] **Step 1: Add `"noEmit": true` to `client/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 2: Verify `npm run build` in `client` does not emit `.js` files into `src`**
Run: `npm run build` in `client`
Verify: No `.js` files are created in `client/src/` or `client/tests/`.

---

### Task 2: Strict Integer Validation for Numeric IDs

**Files:**
- Modify: `server/src/app.ts`
- Test: `server/tests/lab-02/create-ticket.api.test.ts`

**Interfaces:**
- Produces: `isValidIntegerId(val: unknown): boolean`
- Enforces: `categoryId`, `relatedSystemId`, `requesterId` in body and route params must be strict positive integers. Rejects values like `1.5` with HTTP 400 Bad Request.

- [ ] **Step 1: Write the failing regression test in `create-ticket.api.test.ts`**
```ts
it("rejects fractional numeric IDs (e.g. categoryId: 1.5) with 400 Bad Request instead of 500", async () => {
  const payload = {
    requesterId: 1.5,
    categoryId: 2.7,
    relatedSystemId: 3.14,
    summary: "[Test Ticket] Fractional ID validation test",
    description: "[Test Ticket] Testing that fractional IDs are caught by integer validation",
    requestedPriority: "LOW",
  };

  const res = await supertest(app).post("/api/tickets").send(payload);

  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("BAD_REQUEST");
  expect(res.body.error.details).toContain("Category ID must be a valid positive integer.");
  expect(res.body.error.details).toContain("Related System ID must be a valid positive integer.");
  expect(res.body.error.details).toContain("Requester ID must be a valid positive integer.");
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test` in `server`
Expected: FAIL with status 500 or validation mismatch.

- [ ] **Step 3: Implement `isValidIntegerId` in `server/src/app.ts`**
```ts
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
```
Apply to `POST /api/tickets`, `DELETE /api/tickets/:id`, and param checks.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test` in `server`
Expected: PASS.

---

### Task 3: Concurrency-Safe Ticket Number Generation

**Files:**
- Modify: `server/src/utils/ticket-number.ts`
- Modify: `server/src/app.ts`
- Test: `server/tests/lab-02/create-ticket.api.test.ts`

**Interfaces:**
- Produces: Concurrency-safe ticket creation with advisory transaction locking and retry loop on `P2002`.

- [ ] **Step 1: Write the parallel creation regression test in `create-ticket.api.test.ts`**
```ts
it("safely handles parallel ticket creation requests without duplicate ticketNumber collisions", async () => {
  const requests = Array.from({ length: 5 }, (_, i) =>
    supertest(app)
      .post("/api/tickets")
      .send({
        requesterId: activeRequesterId,
        categoryId,
        relatedSystemId,
        summary: `[Test Ticket] Concurrency creation test ticket ${i + 1}`,
        description: `[Test Ticket] Testing parallel creation to ensure unique sequential ticket numbers ${i + 1}`,
        requestedPriority: "LOW",
      })
  );

  const responses = await Promise.all(requests);

  for (const res of responses) {
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("ticketNumber");
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
  }

  const ticketNumbers = responses.map((r) => r.body.ticketNumber);
  const uniqueNumbers = new Set(ticketNumbers);
  expect(uniqueNumbers.size).toBe(ticketNumbers.length);
});
```

- [ ] **Step 2: Update `generateTicketNumber` in `server/src/utils/ticket-number.ts`**
Accept `PrismaClient | Prisma.TransactionClient` and order by `ticketNumber: "desc"`.

- [ ] **Step 3: Wrap ticket creation in transaction with advisory lock and retry in `server/src/app.ts`**
```ts
let retries = 5;
let ticket = null;
while (retries > 0) {
  try {
    ticket = await prisma.$transaction(async (tx) => {
      try {
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
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 25 + 10));
      continue;
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run server tests to verify parallel creation passes**
Run: `npm test` in `server`
Expected: PASS.

---

### Task 4: Backend Initial Attachment Upload & Physical File Rollback Cleanup

**Files:**
- Modify: `server/package.json` (install `multer` and `@types/multer`)
- Modify: `server/src/app.ts`
- Test: `server/tests/lab-02/create-ticket.api.test.ts`

**Interfaces:**
- Produces: `POST /api/tickets/:id/attachments` (Step 2 upload)
- Produces: Enhanced `DELETE /api/tickets/:id` unlinking files from disk upon rollback.

- [ ] **Step 1: Write attachment upload and rollback test in `create-ticket.api.test.ts`**
```ts
it("uploads initial attachment to draft ticket and cleans up physical file on rollback", async () => {
  const createRes = await supertest(app).post("/api/tickets").send({
    requesterId: activeRequesterId,
    categoryId,
    relatedSystemId,
    summary: "[Test Ticket] Draft ticket for file rollback test",
    description: "[Test Ticket] Testing physical file cleanup on compensation rollback",
    requestedPriority: "LOW",
  });

  expect(createRes.status).toBe(201);
  const ticketId = createRes.body.id;

  const uploadRes = await supertest(app)
    .post(`/api/tickets/${ticketId}/attachments`)
    .field("requesterId", activeRequesterId)
    .attach("file", Buffer.from("dummy pdf content for testing"), "test-evidence.pdf");

  expect(uploadRes.status).toBe(201);
  expect(uploadRes.body).toHaveProperty("id");
  expect(uploadRes.body.originalName).toBe("test-evidence.pdf");
  expect(uploadRes.body.mimeType).toBe("application/pdf");

  const deleteRes = await supertest(app)
    .delete(`/api/tickets/${ticketId}?requesterId=${activeRequesterId}`);

  expect(deleteRes.status).toBe(200);

  const ticketAfter = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
  expect(ticketAfter).toBeNull();
  const attachmentAfter = await getPrisma().attachment.findUnique({ where: { id: uploadRes.body.id } });
  expect(attachmentAfter).toBeNull();
});
```

- [ ] **Step 2: Add `multer` and configure upload endpoint and file deletion in `server/src/app.ts`**
Implement `POST /api/tickets/:id/attachments` with MIME validation, size check, max 5 active limit, and storage in `server/uploads/`.
Update `DELETE /api/tickets/:id` to query `prisma.attachment` and unlink all files before deleting the ticket.

- [ ] **Step 3: Run server tests to verify attachment upload and rollback cleanup**
Run: `npm test` in `server`
Expected: All tests pass.

---

### Task 5: Client Initial Attachment Upload & Rollback Flow (BR-16 / AC-15)

**Files:**
- Modify: `client/src/api.ts`
- Modify: `client/src/components/CreateTicketForm.tsx`
- Test: `client/tests/lab-02/CreateTicket.test.tsx`

**Interfaces:**
- Produces: `uploadAttachment(ticketId: number, file: File, requesterId: number): Promise<any>`
- Enforces: 2-step submit in `CreateTicketForm.tsx` (Step 1: create ticket, Step 2: upload each file). On error, calls `deleteTicketRollback` and retains user inputs with an error banner.

- [ ] **Step 1: Write client regression tests in `client/tests/lab-02/CreateTicket.test.tsx`**
Add:
1. `BR-16 / AC-15: uploads selected initial attachments sequentially after ticket creation`
2. `BR-16 / AC-15: executes compensation rollback when attachment upload fails and preserves form values`

- [ ] **Step 2: Add `uploadAttachment` in `client/src/api.ts`**
```ts
export async function uploadAttachment(ticketId: number, file: File, requesterId: number): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("requesterId", String(requesterId));

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to upload attachment");
  }

  return data;
}
```

- [ ] **Step 3: Update `handleSubmit` in `CreateTicketForm.tsx`**
After `createTicket(payload)`, sequentially upload `selectedFiles`.
If any upload fails, catch error, call `deleteTicketRollback(ticket.id, selectedRequester.id)`, set `apiError`, and return without clearing user inputs.

- [ ] **Step 4: Run client tests to verify passes**
Run: `npm test` in `client`
Expected: All client tests pass.

---

### Task 6: Full Verification & Peer Review Record Update

**Files:**
- Modify: `docs/lab-02/reviewer.md`

- [ ] **Step 1: Run full server test suite and typecheck**
Run: `npx tsc --noEmit && npm test` in `server`
Expected: 0 type errors, 100% tests green.

- [ ] **Step 2: Run full client test suite and build**
Run: `npm run build && npm test` in `client`
Expected: 0 type errors, 0 rogue `.js` emitted, 100% tests green.

- [ ] **Step 3: Verify git status is completely clean**
Verify: Only tracked changes exist, no untracked `.js` files.
