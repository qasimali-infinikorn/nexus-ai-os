"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { syncGoogleCalendarAction } from "@/lib/actions/integrations";

type Props = {
  connected: boolean;
  configured: boolean;
  accountEmail?: string | null;
  justSynced?: boolean;
};

export function CalendarSyncBar({ connected, configured, accountEmail, justSynced }: Props) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ error?: string; success?: string } | undefined>();

  if (!configured && !connected) {
    return (
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: -8 }}>
        Google Calendar sync needs <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code>. You can still
        create meetings manually.
      </p>
    );
  }

  if (!connected) {
    return (
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: -8 }}>
        Connect Google Calendar under{" "}
        <Link href="/settings/integrations" style={{ textDecoration: "underline" }}>
          Settings → Integrations
        </Link>{" "}
        to pull the next 14 days of events — or create meetings manually below.
      </p>
    );
  }

  return (
    <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: -8, alignItems: "center" }}>
      <span className="muted" style={{ fontSize: "0.85rem" }}>
        Calendar connected{accountEmail ? ` · ${accountEmail}` : ""}. Sync pulls the next 14 days.
      </span>
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          startTransition(async () => {
            setState(await syncGoogleCalendarAction());
          });
        }}
      >
        <RefreshCw size={14} aria-hidden />
        <span>{pending ? "Syncing…" : "Sync calendar"}</span>
      </button>
      {justSynced || state?.success ? (
        <span className="meta" role="status" style={{ color: "var(--accent-green, #059669)" }}>
          {state?.success ?? "Synced."}
        </span>
      ) : null}
      {state?.error ? (
        <span className="row" role="alert" style={{ gap: 6, color: "var(--danger, #b91c1c)", fontSize: "0.85rem" }}>
          <AlertCircle size={14} aria-hidden />
          {state.error}
        </span>
      ) : null}
    </div>
  );
}
