import { describe, it, expect } from "vitest";
import { formatRelativeTime, orgAuditActionLabel } from "@/lib/workspace/admin-ui";

describe("orgAuditActionLabel", () => {
  it("prefers metadata and falls back to targetId", () => {
    expect(orgAuditActionLabel("invitation.created", { email: "a@b.com" })).toBe("invited a@b.com");
    expect(orgAuditActionLabel("org_provider_key.set", null, "openai")).toBe("set the openai provider key");
    expect(orgAuditActionLabel("project_task.moved", null, "NX-12")).toBe("moved task NX-12");
  });
});

describe("formatRelativeTime", () => {
  it("formats recent timestamps", () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
    expect(formatRelativeTime(null)).toBe("—");
  });
});
