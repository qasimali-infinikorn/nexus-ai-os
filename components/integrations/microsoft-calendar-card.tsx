"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  disconnectMicrosoftCalendarAction,
  syncMicrosoftCalendarAction
} from "@/lib/actions/integrations";
import { Avatar, Pill } from "@/components/workspace/ui";

type Props = {
  configured: boolean;
  connected: boolean;
  accountEmail?: string | null;
  calendarQuery?: string | null;
};

export function MicrosoftCalendarCard({ configured, connected, accountEmail, calendarQuery }: Props) {
  const [pending, startTransition] = useTransition();
  const [syncState, setSyncState] = useState<{ error?: string; success?: string } | undefined>();

  const banner =
    calendarQuery === "not_configured"
      ? "Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to enable Calendar connect."
      : calendarQuery === "denied"
        ? "Microsoft Calendar access was denied."
        : calendarQuery === "invalid_state" || calendarQuery === "error"
          ? "Calendar connect failed. Try again."
          : null;

  return (
    <article className="card card-pad stack-md">
      <div className="row" style={{ gap: 12 }}>
        <Avatar initials="MS" index={3} square />
        <div className="stack" style={{ minWidth: 0 }}>
          <span className="card-title">Microsoft Calendar</span>
          <span className="card-sub">Outlook · personal OAuth (not login)</span>
        </div>
      </div>
      <p className="dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.55 }}>
        Sync the next 14 days from Microsoft Graph into Meeting Assistant. Tokens are encrypted per user
        and org — this does not change how you sign in to Nexus.
      </p>

      {banner ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{banner}</span>
        </div>
      ) : null}
      {syncState?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{syncState.error}</span>
        </div>
      ) : null}
      {syncState?.success ? (
        <p className="meta" role="status" style={{ color: "var(--accent-green, #059669)" }}>
          {syncState.success}
        </p>
      ) : null}

      <div className="row-between" style={{ marginTop: "auto", flexWrap: "wrap", gap: 8 }}>
        <Pill tone={connected ? "green" : "slate"}>
          {connected ? (accountEmail ? `Connected · ${accountEmail}` : "Connected") : "Not connected"}
        </Pill>
        <div className="row" style={{ gap: 8 }}>
          {connected ? (
            <>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={pending}
                aria-busy={pending}
                onClick={() => {
                  startTransition(async () => {
                    setSyncState(await syncMicrosoftCalendarAction());
                  });
                }}
              >
                <RefreshCw size={14} aria-hidden />
                <span>{pending ? "Syncing…" : "Sync now"}</span>
              </button>
              <form action={disconnectMicrosoftCalendarAction}>
                <button type="submit" className="btn-ghost btn-sm">
                  Disconnect
                </button>
              </form>
            </>
          ) : configured ? (
            <Link href="/api/integrations/microsoft-calendar/start" className="btn-primary btn-sm">
              Connect
            </Link>
          ) : (
            <button type="button" className="btn-secondary btn-sm" disabled title="Server env not configured">
              Connect
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
