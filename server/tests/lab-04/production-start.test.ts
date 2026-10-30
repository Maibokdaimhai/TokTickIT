import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { fixture } from "./fixture.js";

// Opt-in: exercises the real compiled entry point with an isolated migrated schema.
describe.skipIf(process.env.LAB4_PRODUCTION_SMOKE !== "1")("Compiled API startup", () => {
  it("builds and serves health plus an authenticated dashboard through npm start", async () => {
    const f = await fixture();
    let child: ChildProcess | undefined;
    try {
      const staff = await f.user("IT_STAFF");
      const listener = createServer();
      await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
      const address = listener.address();
      if (!address || typeof address === "string") throw new Error("Unable to allocate smoke-test port");
      const port = address.port;
      await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
      const env = { ...process.env, DATABASE_URL: f.url.toString(), PORT: String(port), CLIENT_ORIGIN: "http://localhost:5173", NODE_ENV: "test" };
      // A fresh output directory prevents an old dist/src entry from hiding layout drift.
      const output = path.join(process.cwd(), "dist");
      const { rmSync } = await import("node:fs");
      rmSync(output, { recursive: true, force: true });
      execFileSync("npm", ["run", "build"], { cwd: process.cwd(), env, stdio: "pipe", timeout: 30000 });
      let diagnostics = "";
      child = spawn("npm", ["start"], { cwd: process.cwd(), env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout?.on("data", data => { diagnostics += data.toString(); });
      child.stderr?.on("data", data => { diagnostics += data.toString(); });
      const base = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error(`npm start exited ${child.exitCode}: ${diagnostics}`);
        const response = await fetch(`${base}/api/health`).catch(() => undefined);
        if (response?.ok) { expect(await response.json()).toMatchObject({ status: "ok" }); ready = true; break; }
        await delay(100);
      }
      if (!ready) throw new Error("Compiled API did not become ready");
      const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { Origin: env.CLIENT_ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ email: staff.email, password: "Lab4-test-fixture-only1!" }) });
      expect(login.status).toBe(200);
      const cookie = login.headers.get("set-cookie")?.split(";")[0];
      expect(cookie).toMatch(/^toktickit_session=/);
      const dashboard = await fetch(`${base}/api/dashboards/staff`, { headers: { Cookie: cookie! } });
      expect(dashboard.status).toBe(200);
      expect(await dashboard.json()).toMatchObject({ timeZone: "Asia/Bangkok" });
    } finally {
      if (child?.pid && child.exitCode === null && child.signalCode === null) {
        const exited = new Promise<void>(resolve => child!.once("exit", () => resolve()));
        process.kill(-child.pid, "SIGTERM");
        await Promise.race([exited, delay(5000)]);
        if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, "SIGKILL");
      }
      await f.close();
    }
  }, 60000);
});
