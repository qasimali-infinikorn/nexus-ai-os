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

export const connectedServices = [
  { id: "gh", name: "GitHub", detail: "acme-cloud org · 42 repos", initials: "GH", avatarIndex: 0, state: "Connected" as const },
  { id: "sl", name: "Slack", detail: "acme.slack.com · 8 channels", initials: "SL", avatarIndex: 5, state: "Connected" as const },
  { id: "ji", name: "Jira", detail: "Order Platform board", initials: "JI", avatarIndex: 1, state: "Connected" as const },
  { id: "az", name: "Azure DevOps", detail: "CI/CD pipelines", initials: "AZ", avatarIndex: 2, state: "Connected" as const },
  { id: "gd", name: "Google Drive", detail: "Shared: Proposals", initials: "GD", avatarIndex: 4, state: "Connected" as const },
  { id: "m365", name: "Microsoft 365", detail: "Calendar & SharePoint", initials: "M3", avatarIndex: 3, state: "Reauth needed" as const }
];

export const apiKeys = [
  { id: "k1", name: "Production key", masked: "nx_live_••••••••7f2a", lastUsed: "Last used 4 min ago" },
  { id: "k2", name: "CI/CD key", masked: "nx_live_••••••••b91c", lastUsed: "Last used 2 h ago" }
];

export const integrationCatalog = [
  { id: "github", name: "GitHub", category: "Source control", body: "Sync repos, PRs, and reviews into Code Review and agents.", initials: "GH", avatarIndex: 0, connected: true },
  { id: "jira", name: "Jira", category: "Project mgmt", body: "Two-way sync of issues, sprints, and the Kanban board.", initials: "JI", avatarIndex: 1, connected: true },
  { id: "slack", name: "Slack", category: "Comms", body: "Post notifications and let agents answer in channels.", initials: "SL", avatarIndex: 5, connected: true },
  { id: "confluence", name: "Confluence", category: "Docs", body: "Index spaces for grounded Knowledge Base answers.", initials: "CF", avatarIndex: 2, connected: true },
  { id: "datadog", name: "Datadog", category: "Observability", body: "Feed metrics and alerts to the DevOps agent.", initials: "DD", avatarIndex: 3, connected: true },
  { id: "pagerduty", name: "PagerDuty", category: "Incidents", body: "Correlate incidents and auto-draft postmortems.", initials: "PD", avatarIndex: 4, connected: true },
  { id: "figma", name: "Figma", category: "Design", body: "Pull design specs into proposals and reviews.", initials: "FG", avatarIndex: 5, connected: false },
  { id: "linear", name: "Linear", category: "Project mgmt", body: "Alternative issue tracker sync for product teams.", initials: "LN", avatarIndex: 2, connected: false },
  { id: "snyk", name: "Snyk", category: "Security", body: "Dependency scanning for the Security Reviewer agent.", initials: "SN", avatarIndex: 1, connected: false }
];

export const securityControls = [
  { id: "2fa", label: "Two-factor authentication", detail: "Require a TOTP code at every sign-in", on: false },
  { id: "sso", label: "Enforce SSO", detail: "Members must sign in via Okta SAML", on: false },
  { id: "api_restrict", label: "Restrict API key creation", detail: "Only admins can generate new keys", on: true }
];

export const activeSessions = [
  { id: "s1", device: "MacBook Pro · Chrome", where: "San Francisco, US · current", current: true },
  { id: "s2", device: "iPhone 16 · Nexus app", where: "San Francisco, US · 2 h ago", current: false },
  { id: "s3", device: "Linux · Firefox", where: "Austin, US · yesterday", current: false }
];

export const billing = {
  planName: "Enterprise plan",
  price: "$4,200",
  cadence: "/ month",
  renews: "Renews Aug 1, 2026",
  seatsTotal: 42,
  seatsAssigned: 34,
  invoices: [
    { id: "INV-2026-07", date: "July 1, 2026", amount: "$4,200.00", status: "Paid" },
    { id: "INV-2026-06", date: "June 1, 2026", amount: "$4,050.00", status: "Paid" },
    { id: "INV-2026-05", date: "May 1, 2026", amount: "$3,900.00", status: "Paid" },
    { id: "INV-2026-04", date: "April 1, 2026", amount: "$3,900.00", status: "Paid" }
  ]
};

export const workspaceAuditLog = [
  { id: "a1", actor: "Alex Morgan", action: "enabled Enforce SSO", ago: "2 h ago" },
  { id: "a2", actor: "Priya Nair", action: "invited jordan.lee@acmecloud.com", ago: "Yesterday" },
  { id: "a3", actor: "ci-bot", action: "rotated the production API key", ago: "2 days ago" },
  { id: "a4", actor: "Dana Ruiz", action: "exported the Meridian proposal", ago: "3 days ago" }
];
