import { Users, MapPin, Check, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardHead, Pill, DemoNotice } from "@/components/workspace/ui";
import { meetings, meetingActionItems } from "@/lib/workspace/content";

export default function MeetingsPage() {
  const needPrep = meetings.filter((m) => m.needsPrep).length;

  return (
    <>
      <PageHeader
        title="Meeting Assistant"
        description={`${meetings.length} meetings today · ${needPrep} need preparation · calendar sync pending`}
      />

      <DemoNotice>
        Demo schedule. Connecting Google Calendar or Microsoft 365 replaces it with your real meetings; agenda and
        talking-point generation already runs on your configured model.
      </DemoNotice>

      <div className="with-rail">
        <Card>
          <CardHead title="Today" sub="Monday, July 20" bordered />
          <div className="list">
            {meetings.map((m) => (
              <div key={m.id} className="list-row" style={{ gap: 16, flexWrap: "wrap" }}>
                <div className="stack" style={{ flex: "0 0 64px", gap: 2 }}>
                  <span className="strong" style={{ fontSize: "1rem" }}>
                    {m.time}
                  </span>
                  <span className="meta">{m.duration}</span>
                </div>

                <div className="stack" style={{ flex: "1 1 220px", minWidth: 180 }}>
                  <span className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span className="title">{m.title}</span>
                    <Pill tone={m.kindTone}>{m.kind}</Pill>
                  </span>
                  <span className="meta row" style={{ gap: 12 }}>
                    <span className="row" style={{ gap: 4 }}>
                      <Users size={12} aria-hidden /> {m.attendees} attendees
                    </span>
                    <span className="row" style={{ gap: 4 }}>
                      <MapPin size={12} aria-hidden /> {m.location}
                    </span>
                  </span>
                </div>

                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                  <button type="button" className={m.needsPrep ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
                    {m.needsPrep ? <Sparkles size={13} aria-hidden /> : null}
                    <span>{m.action}</span>
                  </button>
                  <button type="button" className="btn-secondary btn-sm">
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="rail">
          <Card>
            <CardHead title="Action items" sub="From the last standup" bordered />
            <div className="card-pad" style={{ paddingTop: 8, paddingBottom: 12 }}>
              {meetingActionItems.map((a) => (
                <div key={a.id} className={`check-row${a.done ? " done" : ""}`}>
                  <span className={`check-box${a.done ? " done" : ""}`} aria-hidden>
                    {a.done ? <Check size={11} strokeWidth={3} /> : null}
                  </span>
                  <span className="check-text">
                    {a.text}
                    <span className="meta" style={{ display: "block" }}>
                      {a.owner}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
