/**
 * Optional PagerDuty Events API v2 trigger for critical platform incidents.
 * Set PAGERDUTY_ROUTING_KEY to enable — no-op when unset.
 */

export async function pageCriticalIncident(params: {
  incidentId: string;
  title: string;
  summary?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY?.trim();
  if (!routingKey) return { ok: true, skipped: true };

  try {
    const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: "trigger",
        dedup_key: `nexus-platform-${params.incidentId}`,
        payload: {
          summary: params.title.slice(0, 1024),
          source: "nexus-ai-os",
          severity: "critical",
          custom_details: {
            summary: params.summary?.slice(0, 2000) ?? null,
            incidentId: params.incidentId
          }
        }
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text.slice(0, 300) || `PagerDuty HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "PagerDuty request failed" };
  }
}
