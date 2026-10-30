import { describe, expect, it } from "vitest";
import { parseActionCreate, parseActionPatch, validateActionState, parseCompletion } from "../../src/validators/action.validator.js";

const createdAt = new Date("2026-01-01T00:00:00Z");
const now = new Date("2026-10-27T09:00:00Z");
const valid = {
  clientRequestId: "fbfe8033-9b10-4b0c-a7a9-45ac46dba970", expectedTicketVersion: 0,
  actionAt: "2026-10-27T09:00:00+07:00", description: " Inspect Wi-Fi ",
  assigneeId: 7, followUpRequired: true, followUpNote: " Confirm connectivity ", status: "IN_PROGRESS",
};
describe("Lab 4 Action validation", () => {
  it("normalizes offset dates and plain text without changing Unicode", () => {
    const input = parseActionCreate(valid);
    expect(input.actionAt.toISOString()).toBe("2026-10-27T02:00:00.000Z");
    expect(input.description).toBe("Inspect Wi-Fi");
    expect(input.followUpNote).toBe("Confirm connectivity");
    expect(input.result).toBeNull();
    expect(() => validateActionState(input, createdAt, now)).not.toThrow();
  });
  it.each(["2026-02-30T10:00:00Z", "2026-10-27T25:00:00Z", "2026-10-27T10:00:00", "garbage"])("rejects invalid date %s", actionAt => {
    expect(() => parseActionCreate({ ...valid, actionAt })).toThrow();
  });
  it.each([0, -1, 1.5, "7", 2147483648, null])("rejects invalid JSON assignee %s", assigneeId => {
    expect(() => parseActionCreate({ ...valid, assigneeId })).toThrow();
  });
  it("rejects spoofed fields, missing flags and terminal creation", () => {
    expect(() => parseActionCreate({ ...valid, performedById: 9 })).toThrow();
    expect(() => parseActionCreate({ ...valid, followUpRequired: undefined })).toThrow();
    expect(() => parseActionCreate({ ...valid, status: "COMPLETED" })).toThrow();
    expect(() => parseActionCreate({ ...valid, clientRequestId: "bad-key" })).toThrow();
  });
  it("checks merged conditional state, date bounds and Unicode limits", () => {
    const input = parseActionCreate(valid);
    expect(() => validateActionState({ ...input, followUpNote: "" }, createdAt, now)).toThrow();
    expect(() => validateActionState({ ...input, status: "COMPLETED", result: null }, createdAt, now)).toThrow();
    expect(() => validateActionState(input, new Date("2027-01-01"), now)).toThrow();
    expect(() => validateActionState(input, createdAt, new Date("2026-10-26"))).toThrow();
    expect(parseActionCreate({ ...valid, description: "😀".repeat(2000) }).description).toHaveLength(4000);
    expect(() => parseActionCreate({ ...valid, description: "😀".repeat(2001) })).toThrow();
  });
  it("only permits nonempty versioned edits and dedicated completion input", () => {
    expect(() => parseActionPatch({ expectedTicketVersion: 0, expectedActionVersion: 0 })).toThrow();
    expect(() => parseActionPatch({ expectedTicketVersion: 0, expectedActionVersion: 0, followUpCompletedAt: now.toISOString() })).toThrow();
    expect(parseCompletion({ expectedTicketVersion: 2, expectedActionVersion: 1, completionNote: " Done " }).completionNote).toBe("Done");
    expect(() => parseCompletion({ expectedTicketVersion: 2, expectedActionVersion: 1, completionNote: " " })).toThrow();
  });
});
