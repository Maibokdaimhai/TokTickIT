import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { decodeFilename, formatContentDisposition } from "../../src/app.js";
import app from "../transport-app.js";
import * as database from "../../src/prisma.js";

afterEach(() => vi.restoreAllMocks());

describe("Issue #26: existing HTTP contract during backend extraction", () => {
  const failures = [
    ["get", "/api/categories", "Failed to fetch categories"],
    ["get", "/api/related-systems", "Failed to fetch related systems"],
    ["post", "/api/tickets", "Failed to create support ticket"],
    ["get", "/api/tickets?requesterId=1", "Failed to query ticket list"],
    ["get", "/api/tickets/1?requesterId=1", "Failed to retrieve ticket details"],
    ["post", "/api/tickets/1/attachments", "Failed to upload attachment"],
    ["get", "/api/tickets/1/attachments/1?requesterId=1", "Failed to stream attachment"],
    ["get", "/api/tickets/1/attachments/1/metadata?requesterId=1", "Failed to retrieve attachment metadata"],
    ["post", "/api/tickets/1/attachments/1/remove", "Failed to execute attachment removal"],
    ["delete", "/api/tickets/1?requesterId=1", "Failed to roll back draft ticket"],
  ] as const;

  it.each(failures)("preserves safe failure for %s %s", async (method, url, message) => {
    vi.spyOn(database, "getPrisma").mockImplementation(() => {
      throw new Error("private database connection details");
    });
    const response = await request(app)[method](url).send({ requesterId: 1 });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message } });
    expect(response.text).not.toContain("private database");
  });

  it("keeps health independent of database availability", async () => {
    const getPrisma = vi.spyOn(database, "getPrisma").mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "TokTickIT API" });
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it("preserves the default Express response for an unknown path", async () => {
    const response = await request(app).get("/api/not-a-route");
    expect(response.status).toBe(404);
    expect(response.type).toBe("text/html");
  });

  it("returns safe JSON for malformed JSON", async () => {
    const response = await request(app).post("/api/tickets")
      .set("Content-Type", "application/json").send('{"summary":');
    expect(response.status).toBe(400);
    expect(response.type).toBe("application/json");
  });
});

describe("Issue #26: filename compatibility exports", () => {
  it.each(["report.pdf", "รายงาน.pdf", "résumé.pdf"])("preserves filename %s", (name) => {
    const multipartName = Buffer.from(name, "utf8").toString("latin1");
    expect(decodeFilename(multipartName)).toBe(name);
    expect(formatContentDisposition("inline", name)).toContain("filename*=UTF-8''" + encodeURIComponent(name));
  });

  it("sanitizes header-breaking characters and retains the attachment fallback", () => {
    expect(formatContentDisposition("inline", 'a"\\\r\n.pdf')).not.toMatch(/[\r\n]/);
    expect(formatContentDisposition("attachment", "")).toBe(
      'attachment; filename="attachment"; filename*=UTF-8\'\'attachment',
    );
  });
});
