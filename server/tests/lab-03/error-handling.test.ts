import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import app from "../../src/app.js";
import * as attachments from "../../src/services/attachment.service.js";
import { asyncHandler } from "../../src/middleware/async-handler.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { ApiError } from "../../src/errors/api-error.js";

let directory: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "toktickit-stream-test-"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});

function serveFile(filePath: string) {
  vi.spyOn(attachments, "downloadAttachment").mockResolvedValue({
    filePath, mimeType: "application/pdf", originalName: "รายงาน.pdf",
  });
  return request(app).get("/api/tickets/1/attachments/2?requesterId=3");
}

function expectJsonFailure(response: request.Response) {
  expect(response.status).toBe(500);
  expect(response.type).toBe("application/json");
  expect(response.headers["content-disposition"]).toBeUndefined();
  expect(response.body).toEqual({ error: {
    code: "INTERNAL_SERVER_ERROR", message: "Failed to stream attachment",
  } });
  expect(response.text).not.toContain(directory);
}

describe("unexpected error diagnostics", () => {
  it("retains the cause and logs safe context without request or error secrets", async () => {
    const failure = Object.assign(new Error("password=private-database-secret"), { code: "EIO" });
    let forwarded: unknown;
    const testApp = express();
    testApp.get("/fail/:id", asyncHandler(async () => { throw failure; }, "Operation failed"));
    testApp.use(((error, _req, _res, next) => { forwarded = error; next(error); }) as express.ErrorRequestHandler);
    testApp.use(errorHandler);
    const response = await request(testApp).get("/fail/private-id?token=private-query")
      .set("Cookie", "session=private-cookie");
    expect(forwarded).toBeInstanceOf(ApiError);
    expect((forwarded as Error).cause).toBe(failure);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message: "Operation failed" } });
    expect(console.error).toHaveBeenCalledTimes(1);
    const log = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(log).toContain("/fail/:id");
    expect(log).toContain("EIO");
    expect(log).toContain("error-handling.test.ts");
    for (const secret of ["private-database-secret", "private-id", "private-query", "private-cookie"]) {
      expect(log).not.toContain(secret);
      expect(response.text).not.toContain(secret);
    }
  });

  it("keeps expected validation errors unchanged without logging them as unexpected", async () => {
    const testApp = express();
    testApp.get("/fail", asyncHandler(async () => {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "Invalid input" });
    }, "Operation failed"));
    testApp.use(errorHandler);
    const response = await request(testApp).get("/fail");
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Invalid input");
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("attachment read-stream lifecycle", () => {
  it("returns JSON when a real stream cannot open a file removed after service validation", async () => {
    // Only bypass the earlier existence check; createReadStream is the real Node implementation.
    expectJsonFailure(await serveFile(path.join(directory, "missing.pdf")));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain("ENOENT");
  });

  it("returns JSON when a real stream opens but fails on its first read", async () => {
    // Opening a directory succeeds; reading it as file bytes fails with EISDIR.
    expectJsonFailure(await serveFile(directory));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain("EISDIR");
  });

  it("streams a real file with its MIME type and Unicode filename", async () => {
    const filePath = path.join(directory, "ok.pdf");
    const bytes = Buffer.from("%PDF-1.4 successful stream");
    fs.writeFileSync(filePath, bytes);
    const response = await serveFile(filePath);
    expect(response.status).toBe(200);
    expect(response.type).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toContain(encodeURIComponent("รายงาน.pdf"));
    expect(response.body).toEqual(bytes);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("closes a partially streamed response instead of appending a JSON error", async () => {
    let started = false;
    const stream = new Readable({ read() {
      if (started) return;
      started = true;
      this.push(Buffer.from("%PDF-partial"));
      setTimeout(() => this.destroy(Object.assign(new Error("private read failure"), { code: "EIO" })), 20);
    } });
    vi.spyOn(fs, "createReadStream").mockImplementation(() => {
      process.nextTick(() => stream.emit("open", 123));
      return stream as fs.ReadStream;
    });
    await expect(serveFile("unused-test-path")).rejects.toThrow();
    expect(stream.destroyed).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private read failure");
  });
});
