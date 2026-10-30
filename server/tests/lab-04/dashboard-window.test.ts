import { describe, it, expect } from "vitest";
import { dashboardWindow } from "../../src/services/dashboard.service.js";

describe("Bangkok seven-calendar-date window", () => {
  it.each([
    ["2026-10-27T16:59:59.999Z", "2026-10-20T17:00:00.000Z"],
    ["2026-10-27T17:00:00.000Z", "2026-10-21T17:00:00.000Z"],
    ["2026-01-01T00:00:00.000Z", "2025-12-25T17:00:00.000Z"],
    ["2024-03-01T00:00:00.000Z", "2024-02-23T17:00:00.000Z"],
  ])("calculates %s without host timezone assumptions", (now, start) => {
    expect(dashboardWindow(new Date(now))).toEqual({ asOf: now, timeZone: "Asia/Bangkok", windowStart: start });
  });
});
