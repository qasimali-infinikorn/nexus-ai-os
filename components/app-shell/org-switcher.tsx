"use client";

import { switchOrganizationAction } from "@/lib/actions/auth";

export type OrgOption = {
  id: string;
  name: string;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member"
};

export function OrgSwitcher({
  organizations,
  currentOrganizationId
}: {
  organizations: OrgOption[];
  currentOrganizationId: string;
}) {
  if (organizations.length <= 1) {
    const only = organizations[0];
    return <p>{only?.name ?? "Workspace"}</p>;
  }

  return (
    <form action={switchOrganizationAction}>
      <label className="sr-only" htmlFor="org-switcher">
        Switch workspace
      </label>
      <select
        id="org-switcher"
        name="organizationId"
        className="org-switcher"
        defaultValue={currentOrganizationId}
        onChange={(e) => {
          e.currentTarget.form?.requestSubmit();
        }}
        aria-label="Switch workspace"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name} · {ROLE_LABELS[org.role] ?? org.role}
          </option>
        ))}
      </select>
    </form>
  );
}
