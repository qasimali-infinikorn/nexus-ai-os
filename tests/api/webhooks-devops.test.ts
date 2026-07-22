import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetRateLimiterForTests } from "@/lib/rate-limit";

vi.mock("@/lib/db/workspace", () => ({
  createDeployment: vi.fn(async (p: { service: string }) => ({ id: "dep-1", ...p })),
  createIncident: vi.fn(async (p: { code: string }) => ({ id: "inc-1", ...p })),
  createNotification: vi.fn(async () => ({ id: "n-1" }))
}));

describe("POST /api/webhooks/devops", () => {
  beforeEach(() => {
    resetRateLimiterForTests();
    vi.resetModules();
    process.env.WEBHOOK_SECRET = "test-webhook-secret";
  });

  it("rejects missing secret", async () => {
    const { POST } = await import("@/app/api/webhooks/devops/route");
    const req = new Request("http://localhost/api/webhooks/devops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "deployment",
        organizationId: "00000000-0000-4000-8000-000000000001",
        service: "api",
        version: "1",
        status: "success"
      })
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("accepts a valid deployment payload", async () => {
    const { POST } = await import("@/app/api/webhooks/devops/route");
    const { createDeployment } = await import("@/lib/db/workspace");
    const req = new Request("http://localhost/api/webhooks/devops", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-webhook-secret"
      },
      body: JSON.stringify({
        type: "deployment",
        organizationId: "00000000-0000-4000-8000-000000000001",
        service: "api",
        version: "v2",
        status: "success"
      })
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(createDeployment).toHaveBeenCalled();
  });

  it("returns 503 when WEBHOOK_SECRET is unset", async () => {
    delete process.env.WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/webhooks/devops/route");
    const req = new Request("http://localhost/api/webhooks/devops", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anything"
      },
      body: JSON.stringify({ type: "incident" })
    });
    const res = await POST(req as never);
    expect(res.status).toBe(503);
  });
});
