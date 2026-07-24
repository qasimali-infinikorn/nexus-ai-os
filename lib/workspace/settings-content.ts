// Settings content mirroring the DESING/ mockup. Items marked `demo: true`
// have no working backend yet and are labelled as such in the UI.

export const NOTIFICATION_EVENTS = [
  { id: "pr_reviews", label: "Pull request reviews", detail: "Requested, approved, or changes" },
  { id: "mentions", label: "Mentions", detail: "When someone @mentions you" },
  { id: "incidents", label: "Production incidents", detail: "New and escalated alerts" },
  { id: "builds", label: "Build & deploy", detail: "Pipeline pass/fail and deploys" },
  { id: "digest", label: "Research digest", detail: "Daily curated digest" },
  { id: "agent_runs", label: "Agent runs", detail: "When an agent finishes a task" }
] as const;

export const NOTIFICATION_CHANNELS = [
  { id: "inApp", label: "In-app" },
  { id: "email", label: "Email" },
  { id: "slack", label: "Slack" }
] as const;

export const DEFAULT_NOTIFICATION_PREFS: Record<string, { inApp: boolean; email: boolean; slack: boolean }> = {
  pr_reviews: { inApp: true, email: true, slack: false },
  mentions: { inApp: true, email: true, slack: true },
  incidents: { inApp: true, email: true, slack: true },
  builds: { inApp: true, email: false, slack: false },
  digest: { inApp: false, email: true, slack: false },
  agent_runs: { inApp: true, email: false, slack: false }
};

/** Planned third-party OAuth / deep integrations — not live connections. */
export type IntegrationCatalogStatus = "planned" | "webhook";

export const integrationCatalog: {
  id: string;
  name: string;
  category: string;
  body: string;
  initials: string;
  avatarIndex: number;
  status: IntegrationCatalogStatus;
}[] = [
  {
    id: "github",
    name: "GitHub",
    category: "Source control",
    body: "PR reviews and Mentions via webhook ingest today. Full OAuth repo sync is not built yet.",
    initials: "GH",
    avatarIndex: 0,
    status: "webhook"
  },
  {
    id: "jira",
    name: "Jira",
    category: "Project mgmt",
    body: "Issue updates and Mentions via webhook ingest (optional Kanban upsert). Two-way OAuth sync is not built yet.",
    initials: "JI",
    avatarIndex: 1,
    status: "webhook"
  },
  {
    id: "slack",
    name: "Slack",
    category: "Comms",
    body: "Personal incoming webhooks work under Notifications. Workspace OAuth install is not built yet.",
    initials: "SL",
    avatarIndex: 5,
    status: "planned"
  },
  {
    id: "confluence",
    name: "Confluence",
    category: "Docs",
    body: "Index spaces for grounded Knowledge Base answers.",
    initials: "CF",
    avatarIndex: 2,
    status: "planned"
  },
  {
    id: "datadog",
    name: "Datadog",
    category: "Observability",
    body: "Feed metrics and alerts to the DevOps agent.",
    initials: "DD",
    avatarIndex: 3,
    status: "planned"
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    category: "Incidents",
    body: "Correlate incidents and auto-draft postmortems.",
    initials: "PD",
    avatarIndex: 4,
    status: "planned"
  },
  {
    id: "figma",
    name: "Figma",
    category: "Design",
    body: "Pull design specs into proposals and reviews.",
    initials: "FG",
    avatarIndex: 5,
    status: "planned"
  },
  {
    id: "linear",
    name: "Linear",
    category: "Project mgmt",
    body: "Alternative issue tracker sync for product teams.",
    initials: "LN",
    avatarIndex: 2,
    status: "planned"
  },
  {
    id: "snyk",
    name: "Snyk",
    category: "Security",
    body: "Dependency scanning for the Security Reviewer agent.",
    initials: "SN",
    avatarIndex: 1,
    status: "planned"
  }
];

export const securityControls = [
  { id: "2fa", label: "Two-factor authentication", detail: "Require a TOTP code at every sign-in" },
  { id: "sso", label: "Enforce SSO", detail: "Members must sign in via your identity provider" },
  { id: "api_restrict", label: "Restrict API key creation", detail: "Only admins can generate workspace API keys" }
];
