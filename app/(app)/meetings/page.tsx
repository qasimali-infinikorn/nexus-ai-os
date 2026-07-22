import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, MapPin, Check, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { listMeetings, listMeetingActionItems } from "@/lib/db/workspace";
import { toggleMeetingActionItemAction } from "@/lib/actions/workspace";
import {
  getGoogleCalendarConnection,
  googleCalendarConfigured
} from "@/lib/integrations/google-calendar";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
import { CalendarSyncBar } from "@/components/meetings/calendar-sync-bar";
import { CreateMeetingForm } from "./create-meeting-form";

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function kindTone(kind: string): "blue" | "violet" | "green" | "slate" {
  if (kind === "1:1" || kind === "internal") return "blue";
  if (kind === "client") return "violet";
  if (kind === "standup") return "green";
  return "slate";
}

export default async function MeetingsPage({
  searchParams
}: {
  searchParams: Promise<{ calendar?: string }>;
}) {
  const session = await auth();
  if (!session?.organizationId || !session.user?.id) redirect("/login");

  const params = await searchParams;
  const [meetings, actionItems, connection] = await Promise.all([
    listMeetings(session.organizationId),
    listMeetingActionItems(session.organizationId),
    getGoogleCalendarConnection(session.user.id, session.organizationId)
  ]);

  const needPrep = meetings.filter((m) => m.needsPrep).length;
  const configured = googleCalendarConfigured();
  const googleCount = meetings.filter((m) => m.source === "google").length;

  return (
    <>
      <PageHeader
        title="Meeting Assistant"
        description={`${meetings.length} meetings · ${needPrep} need preparation${
          connection ? ` · ${googleCount} from Google` : ""
        }`}
      />

      <CalendarSyncBar
        configured={configured}
        connected={Boolean(connection)}
        accountEmail={connection?.accountEmail}
        justSynced={params.calendar === "synced"}
      />

      <CreateMeetingForm />

      <div className="with-rail">
        <Card>
          <CardHead
            title="Upcoming"
            sub={
              meetings.length
                ? meetings[0].startsAt.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric"
                  })
                : "No meetings yet"
            }
            bordered
          />
          {meetings.length === 0 ? (
            <p className="muted card-pad" style={{ textAlign: "center" }}>
              No meetings scheduled. Add one above.
            </p>
          ) : (
            <div className="list">
              {meetings.map((m) => {
                const attendees = Array.isArray(m.attendees) ? m.attendees : [];
                const prepHref = `/ai-workspace?q=${encodeURIComponent(`Prepare agenda for: ${m.title}`)}`;
                return (
                  <div key={m.id} className="list-row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div className="stack" style={{ flex: "0 0 72px", gap: 2 }}>
                      <span className="strong" style={{ fontSize: "1rem" }}>
                        {formatTime(m.startsAt)}
                      </span>
                      {m.endsAt ? (
                        <span className="meta">{formatTime(m.endsAt)}</span>
                      ) : null}
                    </div>

                    <div className="stack" style={{ flex: "1 1 220px", minWidth: 180, gap: 6 }}>
                      <span className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <span className="title">{m.title}</span>
                        <Pill tone={kindTone(m.kind)}>{m.kind}</Pill>
                        {m.source === "google" ? <Pill tone="green">Google</Pill> : null}
                        {m.needsPrep ? <Pill tone="amber">Needs prep</Pill> : null}
                      </span>
                      <span className="meta row" style={{ gap: 12, flexWrap: "wrap" }}>
                        <span className="row" style={{ gap: 4 }}>
                          <Users size={12} aria-hidden /> {attendees.length} attendees
                        </span>
                        {m.location ? (
                          <span className="row" style={{ gap: 4 }}>
                            <MapPin size={12} aria-hidden /> {m.location}
                          </span>
                        ) : null}
                      </span>
                      {m.agenda ? (
                        <p className="dim" style={{ fontSize: "0.85rem", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                          {m.agenda.length > 280 ? `${m.agenda.slice(0, 280)}…` : m.agenda}
                        </p>
                      ) : null}
                    </div>

                    <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                      {m.needsPrep && !m.agenda ? (
                        <Link href={prepHref} className="btn-primary btn-sm">
                          <Sparkles size={13} aria-hidden />
                          <span>Prepare agenda</span>
                        </Link>
                      ) : m.agenda ? (
                        <span className="btn-secondary btn-sm" style={{ pointerEvents: "none" }}>
                          Agenda saved
                        </span>
                      ) : (
                        <Link href={prepHref} className="btn-secondary btn-sm">
                          <Sparkles size={13} aria-hidden />
                          <span>Refresh agenda</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="rail">
          <Card>
            <CardHead title="Action items" sub={`${actionItems.filter((a) => !a.done).length} open`} bordered />
            <div className="card-pad" style={{ paddingTop: 8, paddingBottom: 12 }}>
              {actionItems.length === 0 ? (
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  No action items yet.
                </p>
              ) : (
                actionItems.map((a) => (
                  <form key={a.id} action={toggleMeetingActionItemAction}>
                    <input type="hidden" name="itemId" value={a.id} />
                    <input type="hidden" name="done" value={a.done ? "false" : "true"} />
                    <button
                      type="submit"
                      className={`check-row${a.done ? " done" : ""}`}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        padding: 0
                      }}
                    >
                      <span className={`check-box${a.done ? " done" : ""}`} aria-hidden>
                        {a.done ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                      <span className="check-text">
                        {a.text}
                        <span className="meta" style={{ display: "block" }}>
                          {a.owner}
                        </span>
                      </span>
                    </button>
                  </form>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
