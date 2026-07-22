import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { listFeatureFlags } from "@/lib/db/feature-flags";
import type { FeatureFlagStatus } from "@/lib/db/schema";
import { Card, Pill } from "@/components/workspace/ui";
import type { Tone } from "@/lib/workspace/content";
import { FlagToggle } from "@/components/admin/flag-toggle";
import { FlagAudienceSelect } from "@/components/admin/flag-audience-select";

function statusTone(status: FeatureFlagStatus): Tone {
  switch (status) {
    case "ga":
      return "green";
    case "beta":
      return "amber";
    case "alpha":
      return "violet";
  }
}

export default async function AdminFlagsPage() {
  await requirePlatformAdmin();
  const flags = await listFeatureFlags();

  return (
    <div className="stack-lg">
      <p className="dim" style={{ margin: 0, fontSize: "0.9rem" }}>
        Toggles write <code>platform.flag.*</code> audit events. Tenant apps resolve flags with audience +
        optional per-org overrides.
      </p>

      <Card className="table-scroll admin-table-card">
        {flags.length === 0 ? (
          <p className="dim" style={{ padding: "1.25rem" }}>
            No flags seeded.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Status</th>
                <th>Audience</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.key}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{flag.name}</div>
                    <div className="dim" style={{ fontSize: "0.75rem" }}>
                      <code>{flag.key}</code>
                    </div>
                    <div className="dim" style={{ fontSize: "0.8rem", marginTop: 4, maxWidth: 360 }}>
                      {flag.description}
                    </div>
                  </td>
                  <td>
                    <Pill tone={statusTone(flag.status)}>{flag.status.toUpperCase()}</Pill>
                  </td>
                  <td>
                    <FlagAudienceSelect flagKey={flag.key} audience={flag.audience} />
                  </td>
                  <td>
                    <FlagToggle flagKey={flag.key} enabled={flag.enabled} label={`Toggle ${flag.name}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
