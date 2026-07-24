import { describe, it, expect, afterEach, vi } from "vitest";
import { pageCriticalIncident } from "@/lib/integrations/pagerduty";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PAGERDUTY_ROUTING_KEY;
});

describe("pageCriticalIncident", () => {
  it("skips when routing key is unset", async () => {
    const result = await pageCriticalIncident({ incidentId: "i1", title: "Down" });
    expect(result).toEqual({ ok: true, skipped: true });
  });

  it("posts to PagerDuty Events API when configured", async () => {
    process.env.PAGERDUTY_ROUTING_KEY = "R123";
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => ({ ok: true, status: 202, text: async () => "" }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await pageCriticalIncident({
      incidentId: "inc-1",
      title: "API outage",
      summary: "details"
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBeTruthy();
    const body = JSON.parse(String(init!.body));
    expect(body.routing_key).toBe("R123");
    expect(body.event_action).toBe("trigger");
    expect(body.dedup_key).toBe("nexus-platform-inc-1");
  });
});
