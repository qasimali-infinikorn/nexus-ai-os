"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  syncGoogleCalendarAction,
  syncMicrosoftCalendarAction
} from "@/lib/actions/integrations";

type CalendarLink = {
  provider: "google" | "microsoft";
  connected: boolean;
  configured: boolean;
  accountEmail?: string | null;
};

type Props = {
  google: CalendarLink;
  microsoft: CalendarLink;
  justSynced?: boolean;
};

export function CalendarSyncBar({ google, microsoft, justSynced }: Props) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ error?: string; success?: string } | undefined>();

  const anyConfigured = google.configured || microsoft.configured;
  const anyConnected = google.connected || microsoft.connected;

  if (!anyConfigured && !anyConnected) {
    return (
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: -8 }}>
        Calendar sync needs Google and/or Microsoft OAuth env vars. You can still create meetings manually.
      </p>
    );
  }

  if (!anyConnected) {
    return (
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: -8 }}>
        Connect Google or Microsoft Calendar under{" "}
        <Link href="/settings/integrations" style={{ textDecoration: "underline" }}>
          Settings → Integrations
        </Link>{" "}
        to pull the next 14 days of events — or create meetings manually below.
      </p>
    );
  }

  const sync = (provider: "google" | "microsoft") => {
    startTransition(async () => {
      setState(
        provider === "google" ? await syncGoogleCalendarAction() : await syncMicrosoftCalendarAction()
      );
    });
  };

  return (
    <div className="stack" style={{ gap: 8, marginTop: -8 }}>
      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {google.connected ? (
          <>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Google{google.accountEmail ? ` · ${google.accountEmail}` : ""}
            </span>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={pending}
              aria-busy={pending}
              onClick={() => sync("google")}
            >
              <RefreshCw size={14} aria-hidden />
              <span>Sync Google</span>
            </button>
          </>
        ) : null}
        {microsoft.connected ? (
          <>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Microsoft{microsoft.accountEmail ? ` · ${microsoft.accountEmail}` : ""}
            </span>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={pending}
              aria-busy={pending}
              onClick={() => sync("microsoft")}
            >
              <RefreshCw size={14} aria-hidden />
              <span>Sync Microsoft</span>
            </button>
          </>
        ) : null}
      </div>
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
