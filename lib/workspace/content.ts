// Workspace content for the engineering OS pages.
//
// This is *seed content for a demo workspace* — it mirrors the reference
// design in `DESING/` so a fresh install is immediately explorable end to
// end. It is deliberately a single typed module rather than scattered
// literals so that swapping it for live sources is a contained change:
// each exported collection maps 1:1 to the integration that will replace
// it (pullRequests → GitHub, deployments/incidents → CI + PagerDuty,
// meetings → Google/MS 365, researchItems → the Research Assistant agent).
//
// Nothing here is presented to the user as live production telemetry: the
// app shows a "Demo workspace" marker (see components/workspace/ui.tsx's
// DemoNotice) wherever this content is rendered.

export type Tone = "green" | "amber" | "red" | "blue" | "slate" | "violet";

export const workspace = {
  personName: "Alex Morgan",
  personRole: "Principal Engineer",
  today: "Monday, July 20",
  sprint: "Sprint 24, day 6 of 10"
};

/* ── Dashboard ────────────────────────────────────────────────────────── */

export interface StatCard {
  id: string;
  label: string;
  icon: "calendar" | "git" | "zap" | "alert";
  accent: "blue" | "green" | "amber" | "red" | "violet";
  value: string;
  note: string;
  foot: string;
  footTone: Tone;
  trend: "up" | "down" | "flat";
  spark: number[];
  href: string;
}

export const statCards: StatCard[] = [
  {
    id: "meetings",
    label: "Today's meetings",
    icon: "calendar",
    accent: "blue",
    value: "4",
    note: "Next: Arch review 11:30",
    foot: "2 need prep",
    footTone: "amber",
    trend: "flat",
    spark: [3, 5, 4, 6, 4, 5, 4],
    href: "/meetings"
  },
  {
    id: "prs",
    label: "Pending pull requests",
    icon: "git",
    accent: "violet",
    value: "12",
    note: "3 waiting on your review",
    foot: "4 since Friday",
    footTone: "green",
    trend: "down",
    spark: [16, 15, 14, 15, 13, 12, 12],
    href: "/code-review"
  },
  {
    id: "sprint",
    label: "Sprint health",
    icon: "zap",
    accent: "green",
    value: "87%",
    note: "34 of 42 points complete",
    foot: "On track",
    footTone: "green",
    trend: "up",
    spark: [40, 48, 55, 61, 70, 79, 87],
    href: "/projects"
  },
  {
    id: "alerts",
    label: "Production alerts",
    icon: "alert",
    accent: "red",
    value: "2",
    note: "1 critical · checkout-service",
    foot: "from 5 overnight",
    footTone: "green",
    trend: "down",
    spark: [5, 5, 4, 4, 3, 3, 2],
    href: "/devops"
  }
];

export const deploymentFrequency = {
  title: "Deployment frequency",
  subtitle: "Last 14 days · all services",
  delta: "23% vs prev.",
  labels: ["Jul 6", "Jul 9", "Jul 12", "Jul 15", "Jul 18", "Today"],
  points: [6, 9, 7, 14, 11, 8, 5, 9, 13, 10, 16, 12, 19, 22]
};

export const sprintVelocity = {
  title: "Sprint velocity",
  subtitle: "Committed vs completed, last 6 sprints",
  sprints: [
    { label: "S19", committed: 38, completed: 34 },
    { label: "S20", committed: 40, completed: 37 },
    { label: "S21", committed: 44, completed: 41 },
    { label: "S22", committed: 42, completed: 40 },
    { label: "S23", committed: 46, completed: 44 },
    { label: "S24", committed: 42, completed: 34 }
  ]
};

export const aiActivity = {
  total: 128,
  breakdown: [
    { label: "Research digests", value: 34, color: "#2563eb" },
    { label: "Code review", value: 28, color: "#7c3aed" },
    { label: "Docs & proposals", value: 22, color: "#0d9488" },
    { label: "Meeting prep", value: 16, color: "#94a3b8" }
  ]
};

export interface ActivityEvent {
  id: string;
  actor: string;
  verb: string;
  target: string;
  ago: string;
  icon: "git" | "sparkles" | "alert" | "doc" | "layers";
  tone: Tone;
}

export const recentActivity: ActivityEvent[] = [
  { id: "a1", actor: "Priya Nair", verb: "merged", target: "PR #479 · order-service pagination", ago: "24 min ago", icon: "git", tone: "violet" },
  { id: "a2", actor: "Research Assistant", verb: "published", target: "Daily digest · 12 articles", ago: "1 h ago", icon: "sparkles", tone: "blue" },
  { id: "a3", actor: "PagerDuty", verb: "resolved", target: "INC-291 · Redis eviction spike", ago: "2 h ago", icon: "alert", tone: "red" },
  { id: "a4", actor: "Dana Ruiz", verb: "updated", target: "Meridian proposal · Pricing v3", ago: "3 h ago", icon: "doc", tone: "slate" },
  { id: "a5", actor: "Sam Okafor", verb: "requested review on", target: "ADR-041 · Event-driven inventory", ago: "4 h ago", icon: "layers", tone: "blue" }
];

export const aiSuggestions = [
  {
    id: "s1",
    kind: "Action" as const,
    body: "3 PRs have been idle for 48h+. Reviewers may need a nudge — I can draft the reminders.",
    cta: "Review PRs",
    href: "/code-review"
  },
  {
    id: "s2",
    kind: "Insight" as const,
    body: "checkout-service p95 latency is up 18% since v2.14 deployed. Likely cause: retry loop in payment client.",
    cta: "Open DevOps",
    href: "/devops"
  }
];

export interface Task {
  id: string;
  title: string;
  tag: string;
  done: boolean;
}

export const myTasks: Task[] = [
  { id: "t1", title: "Review PR #482 — idempotency keys", tag: "PR", done: false },
  { id: "t2", title: "Prep Q3 architecture review deck", tag: "Doc", done: false },
  { id: "t3", title: "Sign off Meridian proposal pricing", tag: "Prop", done: true },
  { id: "t4", title: "Close incident INC-291 retro", tag: "Ops", done: false }
];

export const agentActivity = [
  { id: "aa1", agent: "Security Reviewer", body: "flagged 1 medium finding in PR #482", ago: "38 min ago" },
  { id: "aa2", agent: "Meeting Assistant", body: "drafted the agenda for Q3 architecture review", ago: "1 h ago" },
  { id: "aa3", agent: "Knowledge Agent", body: "indexed 214 new Confluence pages", ago: "4 h ago" }
];

/* ── Meetings ─────────────────────────────────────────────────────────── */

export interface Meeting {
  id: string;
  time: string;
  duration: string;
  title: string;
  kind: string;
  kindTone: Tone;
  attendees: number;
  location: string;
  action: string;
  needsPrep: boolean;
}

export const meetings: Meeting[] = [
  { id: "m1", time: "9:30", duration: "15 min", title: "Platform standup", kind: "Recurring", kindTone: "slate", attendees: 8, location: "Zoom", action: "Standup notes ready", needsPrep: false },
  { id: "m2", time: "11:30", duration: "60 min", title: "Q3 architecture review", kind: "Needs prep", kindTone: "amber", attendees: 6, location: "Room 4A", action: "Generate agenda", needsPrep: true },
  { id: "m3", time: "14:00", duration: "45 min", title: "Meridian client sync", kind: "External", kindTone: "violet", attendees: 4, location: "Google Meet", action: "Prep brief", needsPrep: true },
  { id: "m4", time: "16:30", duration: "30 min", title: "1:1 with Priya Nair", kind: "1:1", kindTone: "blue", attendees: 2, location: "Zoom", action: "Talking points", needsPrep: false }
];

export const meetingActionItems = [
  { id: "ai1", text: "Finalize idempotency key salt with security", owner: "Alex Morgan", done: false },
  { id: "ai2", text: "Share Kafka MirrorMaker cost estimate", owner: "Sam Okafor", done: false },
  { id: "ai3", text: "Publish ADR-041 for team review", owner: "Priya Nair", done: true },
  { id: "ai4", text: "Book follow-up with Meridian procurement", owner: "Dana Ruiz", done: false }
];

/* ── Agents ───────────────────────────────────────────────────────────── */

export interface Agent {
  id: string;
  slug: string;
  name: string;
  status: "running" | "active" | "idle";
  description: string;
  integrations: string[];
  lastRun: string;
  lastRunAgo: string;
  accent: "blue" | "green" | "amber" | "red" | "violet";
  /** Which lib/agents.ts system prompt this card runs, when it maps to one. */
  agentType?: string;
}

export const agents: Agent[] = [
  { id: "ag1", slug: "engineering-lead", name: "Engineering Lead", status: "running", description: "Orchestrates code review, ADRs, and technical planning across the platform team.", integrations: ["GitHub", "Jira", "Confluence"], lastRun: "Drafted ADR-042", lastRunAgo: "8 min ago", accent: "blue", agentType: "eng_lead" },
  { id: "ag2", slug: "architecture-advisor", name: "Architecture Advisor", status: "active", description: "Evaluates system designs, flags coupling and scaling risks, recommends patterns.", integrations: ["Mermaid", "AWS", "Backstage"], lastRun: "Reviewed inventory sync", lastRunAgo: "1 h ago", accent: "violet", agentType: "architecture" },
  { id: "ag3", slug: "proposal-generator", name: "Proposal Generator", status: "active", description: "Assembles client proposals from templates, pricing models, and delivery plans.", integrations: ["Docs", "HubSpot", "PDF"], lastRun: "Meridian proposal v3", lastRunAgo: "3 h ago", accent: "green", agentType: "proposal" },
  { id: "ag4", slug: "research-assistant", name: "Research Assistant", status: "active", description: "Curates a daily digest of releases, papers, and security advisories that matter to us.", integrations: ["RSS", "arXiv", "GitHub"], lastRun: "Published digest", lastRunAgo: "1 h ago", accent: "blue", agentType: "research" },
  { id: "ag5", slug: "knowledge-agent", name: "Knowledge Agent", status: "active", description: "Semantic search and answers grounded in Confluence, SharePoint, and repo docs.", integrations: ["Confluence", "SharePoint", "Repos"], lastRun: "Indexed 214 pages", lastRunAgo: "4 h ago", accent: "violet", agentType: "knowledge" },
  { id: "ag6", slug: "client-meeting-assistant", name: "Client Meeting Assistant", status: "idle", description: "Preps agendas, transcribes calls, extracts action items and decisions.", integrations: ["Calendar", "Zoom", "Email"], lastRun: "Q3 review agenda", lastRunAgo: "1 h ago", accent: "green", agentType: "client_meeting" },
  { id: "ag7", slug: "documentation-agent", name: "Documentation Agent", status: "idle", description: "Keeps READMEs, runbooks, and API docs in sync with the codebase.", integrations: ["GitHub", "OpenAPI", "MDX"], lastRun: "Updated 6 runbooks", lastRunAgo: "yesterday", accent: "amber", agentType: "documentation" },
  { id: "ag8", slug: "devops-agent", name: "DevOps Agent", status: "running", description: "Watches deployments, correlates alerts, and proposes remediation runbooks.", integrations: ["K8s", "Datadog", "PagerDuty"], lastRun: "Correlated INC-291", lastRunAgo: "2 h ago", accent: "blue" },
  { id: "ag9", slug: "security-reviewer", name: "Security Reviewer", status: "active", description: "Scans diffs and dependencies for vulnerabilities, secrets, and policy violations.", integrations: ["Snyk", "Semgrep", "GitHub"], lastRun: "1 finding in PR #482", lastRunAgo: "38 min ago", accent: "red" }
];

export const agentStats = { count: 9, runsThisWeek: 128, successRate: "99.2%" };

/* ── AI Workspace ─────────────────────────────────────────────────────── */

export const suggestedPrompts = [
  "Summarize the last 5 merged PRs in payments-service",
  "Generate a threat model for the new webhook endpoint",
  "Draft release notes for v2.15 from the changelog",
  "Compare our Redis vs DynamoDB caching costs at 10k RPS"
];

export const workspaceHistory = [
  { id: "h1", title: "Security review of PR #482", ago: "38 min ago" },
  { id: "h2", title: "Q3 architecture review agenda", ago: "2 h ago" },
  { id: "h3", title: "Meridian proposal — pricing section", ago: "Yesterday" },
  { id: "h4", title: "Kubernetes cost optimization plan", ago: "2 days ago" }
];

export const workspaceContextChips = ["PR #482 diff", "inventory-service/README", "ADR-041"];

/* ── Code Review ──────────────────────────────────────────────────────── */

export interface PullRequest {
  number: number;
  title: string;
  repo: string;
  state: "review_requested" | "approved" | "merged";
  openedAgo: string;
  additions: number;
  deletions: number;
  checks: string;
  checksOk: boolean;
  author: string;
  authorInitials: string;
  avatarIndex: number;
  branch: string;
  baseBranch: string;
  commits: number;
  coverageDelta: string;
  coverageTotal: string;
  qualityScore: number;
  mergeRecommendation: string;
  qualitySummary: string;
  files: { path: string; additions: number; deletions: number }[];
  diff: { path: string; startLine: number; lines: { kind: "ctx" | "add" | "del"; text: string }[] };
  findings: { id: string; kind: string; severity?: string; location: string; body: string; tone: "warn" | "info" | "ok" }[];
}

export const pullRequests: PullRequest[] = [
  {
    number: 482,
    title: "Add idempotency keys to payment client",
    repo: "payments-service",
    state: "review_requested",
    openedAgo: "opened 5h ago",
    additions: 214,
    deletions: 58,
    checks: "11/12",
    checksOk: false,
    author: "priya-nair",
    authorInitials: "PN",
    avatarIndex: 1,
    branch: "feat/payment-idempotency",
    baseBranch: "main",
    commits: 6,
    coverageDelta: "+2.4%",
    coverageTotal: "84.1% total",
    qualityScore: 87,
    mergeRecommendation: "Approve with fix",
    qualitySummary: "Good coverage and clear naming. One medium security finding to resolve before merge.",
    files: [
      { path: "payments/client.ts", additions: 46, deletions: 12 },
      { path: "payments/idempotency.ts", additions: 88, deletions: 0 },
      { path: "payments/client.test.ts", additions: 54, deletions: 4 },
      { path: "orders/checkout.ts", additions: 18, deletions: 22 },
      { path: "db/migrations/0042.sql", additions: 8, deletions: 0 }
    ],
    diff: {
      path: "src/payments/client.ts",
      startLine: 41,
      lines: [
        { kind: "ctx", text: "async function charge(amount: number, method: PaymentMethod) {" },
        { kind: "del", text: "  const res = await gateway.charge(amount, method);" },
        { kind: "add", text: "  const key = idempotencyKey(orderId, amount, method);" },
        { kind: "add", text: "  const res = await gateway.charge(amount, method, { key });" },
        { kind: "ctx", text: '  if (res.status === "duplicate") return res.original;' },
        { kind: "ctx", text: "  return res;" }
      ]
    },
    findings: [
      { id: "f1", kind: "Security", severity: "Medium", location: "client.ts:43", body: "Idempotency key derives from a client-supplied orderId without a server-side salt. Add a namespace prefix to prevent cross-tenant key collisions.", tone: "warn" },
      { id: "f2", kind: "Performance", location: "idempotency.ts:22", body: "The Redis SETNX + GET round-trips can be collapsed into a single Lua script to halve latency on the hot path.", tone: "info" },
      { id: "f3", kind: "Suggestion", location: "client.test.ts", body: "Nice coverage on the duplicate path. Consider adding a test for concurrent charges racing on the same key.", tone: "ok" }
    ]
  },
  {
    number: 481,
    title: "order-service cursor pagination",
    repo: "order-service",
    state: "review_requested",
    openedAgo: "opened 8h ago",
    additions: 96,
    deletions: 40,
    checks: "passing",
    checksOk: true,
    author: "sam-okafor",
    authorInitials: "SO",
    avatarIndex: 2,
    branch: "feat/cursor-pagination",
    baseBranch: "main",
    commits: 4,
    coverageDelta: "+0.8%",
    coverageTotal: "81.6% total",
    qualityScore: 92,
    mergeRecommendation: "Approve",
    qualitySummary: "Clean implementation with solid test coverage on boundary conditions.",
    files: [
      { path: "orders/list.ts", additions: 52, deletions: 28 },
      { path: "orders/cursor.ts", additions: 30, deletions: 0 },
      { path: "orders/list.test.ts", additions: 14, deletions: 12 }
    ],
    diff: {
      path: "src/orders/list.ts",
      startLine: 18,
      lines: [
        { kind: "ctx", text: "export async function listOrders(params: ListParams) {" },
        { kind: "del", text: "  const offset = params.page * params.pageSize;" },
        { kind: "add", text: "  const cursor = decodeCursor(params.cursor);" },
        { kind: "ctx", text: "  const rows = await db.query(...);" }
      ]
    },
    findings: [
      { id: "f4", kind: "Suggestion", location: "cursor.ts:12", body: "Consider encoding a schema version into the cursor so future changes stay backward compatible.", tone: "ok" }
    ]
  },
  {
    number: 480,
    title: "Structured JSON logging middleware",
    repo: "platform-lib",
    state: "review_requested",
    openedAgo: "opened yesterday",
    additions: 132,
    deletions: 12,
    checks: "passing",
    checksOk: true,
    author: "dana-ruiz",
    authorInitials: "DR",
    avatarIndex: 3,
    branch: "feat/structured-logging",
    baseBranch: "main",
    commits: 3,
    coverageDelta: "+1.2%",
    coverageTotal: "78.9% total",
    qualityScore: 89,
    mergeRecommendation: "Approve",
    qualitySummary: "Well-scoped middleware. Redaction list should be centrally configurable.",
    files: [
      { path: "logging/middleware.ts", additions: 96, deletions: 8 },
      { path: "logging/redact.ts", additions: 36, deletions: 4 }
    ],
    diff: {
      path: "src/logging/middleware.ts",
      startLine: 24,
      lines: [
        { kind: "ctx", text: "export function requestLogger(req, res, next) {" },
        { kind: "del", text: "  console.log(`${req.method} ${req.url}`);" },
        { kind: "add", text: "  logger.info({ method: req.method, url: req.url, traceId });" },
        { kind: "ctx", text: "  next();" }
      ]
    },
    findings: [
      { id: "f5", kind: "Security", severity: "Low", location: "redact.ts:8", body: "Redaction keys are hard-coded. Move to shared config so every service redacts the same fields.", tone: "warn" }
    ]
  },
  {
    number: 478,
    title: "Bump Kafka client to 3.7",
    repo: "inventory-service",
    state: "approved",
    openedAgo: "opened 2d ago",
    additions: 8,
    deletions: 6,
    checks: "passing",
    checksOk: true,
    author: "alex-morgan",
    authorInitials: "AM",
    avatarIndex: 0,
    branch: "chore/kafka-3.7",
    baseBranch: "main",
    commits: 1,
    coverageDelta: "0.0%",
    coverageTotal: "80.2% total",
    qualityScore: 95,
    mergeRecommendation: "Approve",
    qualitySummary: "Straightforward dependency bump with no API surface changes.",
    files: [
      { path: "package.json", additions: 2, deletions: 2 },
      { path: "kafka/consumer.ts", additions: 6, deletions: 4 }
    ],
    diff: {
      path: "src/kafka/consumer.ts",
      startLine: 11,
      lines: [
        { kind: "del", text: '  import { Kafka } from "kafkajs@3.6";' },
        { kind: "add", text: '  import { Kafka } from "kafkajs@3.7";' },
        { kind: "ctx", text: "  const consumer = kafka.consumer({ groupId });" }
      ]
    },
    findings: []
  }
];

export const codeReviewStats = { open: 4, awaitingYou: 3, avgReviewTime: "4.2h" };

/* ── DevOps ───────────────────────────────────────────────────────────── */

export const devopsSummary = {
  environment: "production",
  region: "us-east-1",
  services: 14,
  activeIncident: "INC-291"
};

export const serviceHealth = [
  { id: "cpu", label: "CPU", state: "Nominal", tone: "green" as Tone, value: "62%", pct: 62, bar: "green" as const },
  { id: "mem", label: "Memory", state: "Elevated", tone: "amber" as Tone, value: "78%", pct: 78, bar: "amber" as const },
  { id: "pods", label: "Pods", state: "Healthy", tone: "green" as Tone, value: "84/90", pct: 93, bar: "green" as const },
  { id: "err", label: "Error rate", state: "Watch", tone: "amber" as Tone, value: "0.9%", pct: 18, bar: "amber" as const }
];

export interface Deployment {
  id: string;
  service: string;
  version: string;
  detail: string;
  status: "Live" | "Canary" | "Building" | "Rolled back";
  tone: Tone;
}

export const deployments: Deployment[] = [
  { id: "d1", service: "orders-service", version: "v3.8.1", detail: "deployed by priya-nair · 12 min ago", status: "Live", tone: "green" },
  { id: "d2", service: "checkout-service", version: "v2.14.0", detail: "canary 25% · elevated latency", status: "Canary", tone: "amber" },
  { id: "d3", service: "inventory-service", version: "v1.22.3", detail: "pipeline #1841 · building", status: "Building", tone: "blue" },
  { id: "d4", service: "notify-service", version: "v4.1.0", detail: "deployed by ci-bot · 1 h ago", status: "Live", tone: "green" },
  { id: "d5", service: "ledger-service", version: "v2.0.7", detail: "rollback from v2.0.8 · 3 h ago", status: "Rolled back", tone: "red" }
];

export const incidents = [
  { id: "i1", code: "INC-291", title: "checkout-service p95 latency breached SLO", severity: "Sev-2", status: "Mitigating", tone: "amber" as Tone, summary: "DevOps Agent correlated the spike to a retry loop in the payment client introduced in v2.14. Canary held at 25%.", ago: "38 min ago" },
  { id: "i2", code: "INC-288", title: "Redis eviction spike on session store", severity: "Sev-3", status: "Resolved", tone: "green" as Tone, summary: "maxmemory-policy corrected to allkeys-lru and the instance was resized. No customer impact.", ago: "2 h ago" }
];

export const requestSeries = {
  title: "Request rate & error ratio",
  subtitle: "Last 60 minutes · all services",
  points: [820, 910, 870, 940, 1020, 980, 1100, 1180, 1090, 1220, 1310, 1260, 1180, 1240]
};

/* ── Projects ─────────────────────────────────────────────────────────── */

export interface Project {
  id: string;
  name: string;
  key: string;
  initials: string;
  avatarIndex: number;
  lead: string;
  status: "On track" | "At risk" | "Off track";
  tone: Tone;
  sprint: string;
  progress: number;
  openIssues: number;
  engineers: number;
  extra?: string;
  extraTone?: Tone;
}

export const projects: Project[] = [
  { id: "p1", name: "Order Platform", key: "NX", initials: "OP", avatarIndex: 0, lead: "Alex Morgan", status: "On track", tone: "green", sprint: "Sprint 24 · day 6/10", progress: 81, openIssues: 9, engineers: 6 },
  { id: "p2", name: "Payments Modernization", key: "PAY", initials: "PY", avatarIndex: 1, lead: "Priya Nair", status: "At risk", tone: "amber", sprint: "Sprint 12 · day 8/10", progress: 64, openIssues: 14, engineers: 5, extra: "1 blocker", extraTone: "red" },
  { id: "p3", name: "Data Platform", key: "DATA", initials: "DP", avatarIndex: 2, lead: "Sam Okafor", status: "On track", tone: "green", sprint: "Sprint 7 · day 3/10", progress: 38, openIssues: 11, engineers: 4 },
  { id: "p4", name: "Mobile Checkout", key: "MOB", initials: "MB", avatarIndex: 3, lead: "Dana Ruiz", status: "On track", tone: "green", sprint: "Sprint 19 · day 9/10", progress: 92, openIssues: 4, engineers: 3 },
  { id: "p5", name: "Infra & Reliability", key: "INF", initials: "IN", avatarIndex: 4, lead: "Alex Morgan", status: "Off track", tone: "red", sprint: "Sprint 15 · day 5/10", progress: 55, openIssues: 17, engineers: 5, extra: "2 incidents", extraTone: "red" },
  { id: "p6", name: "Developer Experience", key: "DX", initials: "DX", avatarIndex: 5, lead: "Sam Okafor", status: "On track", tone: "green", sprint: "Sprint 9 · day 2/10", progress: 24, openIssues: 7, engineers: 3 }
];

export const projectStats = { active: 6, teams: 3, portfolioHealth: 82 };

/* ── Architecture ─────────────────────────────────────────────────────── */

export const architecture = {
  system: "Order Platform",
  services: 14,
  analyzedAgo: "2 h ago",
  diagram: `graph LR
  GW[API Gateway] --> ORD[Orders]
  GW --> CHK[Checkout]
  ORD --> INV[Inventory]
  ORD --> PAY[Payments]
  CHK --> PAY
  INV --> KFK[(Kafka)]
  PAY --> LDG[Ledger]
  KFK --> NTF[Notifications]`,
  nodes: [
    { id: "gw", label: "API Gateway", x: 4, y: 44, tone: "green" as Tone, primary: true },
    { id: "ord", label: "Orders", x: 30, y: 20, tone: "green" as Tone },
    { id: "chk", label: "Checkout", x: 30, y: 68, tone: "amber" as Tone },
    { id: "inv", label: "Inventory", x: 58, y: 8, tone: "red" as Tone },
    { id: "pay", label: "Payments", x: 58, y: 44, tone: "green" as Tone, primary: true },
    { id: "kfk", label: "Kafka", x: 58, y: 80, tone: "green" as Tone },
    { id: "ldg", label: "Ledger", x: 84, y: 44, tone: "green" as Tone }
  ],
  edges: [
    ["gw", "ord"], ["gw", "chk"], ["ord", "inv"], ["ord", "pay"],
    ["chk", "pay"], ["inv", "kfk"], ["pay", "ldg"]
  ],
  risks: [
    { id: "r1", tone: "red" as Tone, title: "Inventory is a latency hotspot", body: "Synchronous fan-out drives p95 to 640ms under load. Recommend event-driven decoupling (see ADR-042)." },
    { id: "r2", tone: "amber" as Tone, title: "Single Kafka cluster, no DR", body: "The event bus is a shared failure domain with no cross-region replica. Add MirrorMaker to a standby region." },
    { id: "r3", tone: "amber" as Tone, title: "Payments retries un-bounded", body: "No circuit breaker on the gateway client; a downstream outage can cascade into thread exhaustion." }
  ],
  cost: {
    total: "$18,420",
    delta: "9% projected",
    lines: [
      { label: "Compute (EKS)", value: "$9,240", pct: 100, color: "#2563eb" },
      { label: "Data (RDS + Redis)", value: "$4,180", pct: 45, color: "#7c3aed" },
      { label: "Kafka (MSK)", value: "$3,100", pct: 34, color: "#0d9488" },
      { label: "Egress + other", value: "$1,900", pct: 21, color: "#94a3b8" }
    ]
  },
  recommendations: [
    "Move Inventory sync to Kafka events; project 34% p95 reduction.",
    "Introduce a circuit breaker (resilience4j) on the payment gateway client.",
    "Right-size the Orders node pool — 40% headroom idle over the last 30 days."
  ]
};

/* ── Knowledge Base ───────────────────────────────────────────────────── */

export const knowledgeSources = [
  { id: "all", label: "All", count: "42.2k" },
  { id: "confluence", label: "Confluence", count: "18.2k" },
  { id: "github", label: "GitHub", count: "9.4k" },
  { id: "sharepoint", label: "SharePoint", count: "6.1k" },
  { id: "pdfs", label: "PDFs", count: "4.8k" },
  { id: "adrs", label: "Architecture Docs", count: "3.6k" }
];

export const knowledgeStats = { sources: 8, documents: "42,180" };

export const knowledgeResults = [
  { id: "k1", source: "Confluence", path: "Platform / Payments", match: "96% match", title: "Payment Idempotency & Retry Playbook", snippet: "Every write to the payment gateway must carry an idempotency key derived from {tenant}:{orderId}:{amount}. On retry, the gateway returns the original result rather than double-charging…", updated: "Updated 2 days ago · Priya Nair" },
  { id: "k2", source: "GitHub", path: "payments-service / docs", match: "91% match", title: "ADR-038 — Gateway client retry policy", snippet: "We adopt exponential backoff with full jitter, capped at 5 attempts. Circuit breaking is deferred to ADR-042 pending the idempotency work landing…", updated: "Updated 5 days ago · Alex Morgan" },
  { id: "k3", source: "SharePoint", path: "Engineering / Standards", match: "88% match", title: "Microservice Testing Standards v4", snippet: "Every service ships contract tests against its published OpenAPI spec. Integration suites run against ephemeral namespaces, never shared staging…", updated: "Updated 2 weeks ago · Sam Okafor" },
  { id: "k4", source: "Confluence", path: "Platform / Runbooks", match: "84% match", title: "Redis eviction incident runbook", snippet: "If eviction rate exceeds 500/s, check maxmemory-policy first — allkeys-lru is required for the session store. Resize before flushing…", updated: "Updated 3 weeks ago · Dana Ruiz" }
];

/* ── Research Center ──────────────────────────────────────────────────── */

export const researchCategories = ["All", "AI", "Cloud", "DevOps", "Security", "GitHub Trending"];

export const researchItems = [
  { id: "r1", category: "AI", source: "Anthropic", ago: "2 h ago", title: "Claude gains extended tool-use for multi-step agent workflows", summary: "New API surface lets a single request chain up to 20 tool calls with automatic state passing — relevant to our agent orchestration layer.", initials: "CL", avatarIndex: 0 },
  { id: "r2", category: "Cloud", source: "AWS", ago: "3 h ago", title: "EKS adds native pod-level cost allocation", summary: "Kubecost-style breakdowns now ship in the console. Could replace our self-hosted cost exporter and cut the Infra backlog by a sprint.", initials: "AW", avatarIndex: 4 },
  { id: "r3", category: "Security", source: "NIST", ago: "5 h ago", title: "Post-quantum TLS guidance moves to final draft", summary: "Hybrid X25519+ML-KEM is the recommended migration path. No action needed this quarter, but it affects our 2027 crypto roadmap.", initials: "NI", avatarIndex: 3 },
  { id: "r4", category: "DevOps", source: "CNCF", ago: "8 h ago", title: "Argo Rollouts 1.8 adds analysis-driven canary gates", summary: "Automatic promotion based on Prometheus queries — directly applicable to the checkout-service canary that is currently held at 25%.", initials: "CN", avatarIndex: 5 },
  { id: "r5", category: "GitHub Trending", source: "GitHub", ago: "12 h ago", title: "pgvector 0.9 ships HNSW index build parallelism", summary: "Index builds are 4-6x faster on multicore. Worth benchmarking against our Knowledge Base ingestion path.", initials: "GH", avatarIndex: 2 },
  { id: "r6", category: "AI", source: "OpenAI", ago: "1 d ago", title: "Structured outputs now guarantee schema conformance", summary: "Removes the need for retry-on-parse-failure wrappers in our proposal generator.", initials: "OA", avatarIndex: 1 }
];

export const researchStats = { digestDate: "Monday, July 20", newCount: 12, bookmarks: 7 };

/* ── Proposal Studio ──────────────────────────────────────────────────── */

export const proposalTemplates = [
  { id: "pt1", title: "Platform Modernization", subtitle: "Migration & cloud re-architecture", icon: "server" as const },
  { id: "pt2", title: "Security Assessment", subtitle: "Threat model & remediation plan", icon: "shield" as const },
  { id: "pt3", title: "Data & ML Platform", subtitle: "Pipelines, warehouse, governance", icon: "database" as const },
  { id: "pt4", title: "Staff Augmentation", subtitle: "Embedded delivery pod", icon: "users" as const }
];

export const proposals = [
  { id: "pr1", initials: "MR", avatarIndex: 0, title: "Platform Modernization & Cloud Migration", client: "Meridian Retail", updated: "updated 2 min ago", sections: "3 of 6 sections", value: "$1.03M", status: "Draft", tone: "slate" as Tone },
  { id: "pr2", initials: "NV", avatarIndex: 2, title: "Data Platform & Analytics Rebuild", client: "Novacon", updated: "updated yesterday", sections: "7 of 7 sections", value: "$840K", status: "In review", tone: "blue" as Tone },
  { id: "pr3", initials: "HL", avatarIndex: 1, title: "Zero-Trust Security Assessment", client: "Helios Bank", updated: "updated 3 days ago", sections: "5 of 5 sections", value: "$620K", status: "Sent", tone: "amber" as Tone },
  { id: "pr4", initials: "AT", avatarIndex: 4, title: "Embedded Delivery Pod — Q4", client: "Atlas Logistics", updated: "updated last week", sections: "4 of 4 sections", value: "$410K", status: "Won", tone: "green" as Tone },
  { id: "pr5", initials: "OR", avatarIndex: 5, title: "Event-Driven Order Pipeline", client: "Orbit Dynamics", updated: "updated 2 weeks ago", sections: "6 of 6 sections", value: "$320K", status: "Won", tone: "green" as Tone }
];

export const proposalStats = { count: 7, pipeline: "$3.2M", winRate: "62%" };

/* ── Notifications ────────────────────────────────────────────────────── */

export const notificationFilters = ["All", "Mentions", "Reviews", "Incidents"];

export const notifications = [
  { id: "n1", group: "Today", kind: "Incidents", title: "Production incident INC-291", badge: "Critical", tone: "red" as Tone, body: "checkout-service p95 latency breached SLO. DevOps Agent applied mitigation — awaiting your acknowledgment.", ago: "38 min ago", unread: true, href: "/devops" },
  { id: "n2", group: "Today", kind: "Reviews", title: "priya-nair requested your review", tone: "violet" as Tone, body: "PR #482 · Add idempotency keys to payment client. Security Reviewer flagged 1 medium finding.", ago: "1 h ago", unread: true, href: "/code-review/482" },
  { id: "n3", group: "Today", kind: "Mentions", title: "sam-okafor mentioned you", tone: "blue" as Tone, body: "“@alex can you sign off on ADR-042 before the 11:30 review?” in #platform-arch", ago: "2 h ago", unread: true, href: "/architecture" },
  { id: "n4", group: "Today", kind: "Mentions", title: "Research digest is ready", tone: "green" as Tone, body: "Research Assistant published 12 new articles across AI, Cloud, and Security.", ago: "4 h ago", unread: true, href: "/research-center" },
  { id: "n5", group: "Yesterday", kind: "Reviews", title: "dana-ruiz merged PR #479", tone: "violet" as Tone, body: "order-service pagination shipped to production with no regressions.", ago: "Yesterday", unread: false, href: "/code-review" },
  { id: "n6", group: "Yesterday", kind: "Incidents", title: "INC-288 resolved", tone: "green" as Tone, body: "Redis eviction spike on session store closed out. Retro scheduled for Thursday.", ago: "Yesterday", unread: false, href: "/devops" }
];

/* ── Settings ─────────────────────────────────────────────────────────── */

export const usageStats = {
  tokensUsed: "2.4M",
  tokenLimit: "5M",
  tokenPct: 48,
  agentRuns: 312,
  docsGenerated: 48,
  successRate: "99.2%"
};

export const connectedServices = [
  { id: "cs1", name: "GitHub", detail: "acme-cloud", initials: "GH", avatarIndex: 0, connected: true },
  { id: "cs2", name: "Jira", detail: "acme.atlassian.net", initials: "JR", avatarIndex: 1, connected: true },
  { id: "cs3", name: "Confluence", detail: "Platform space", initials: "CF", avatarIndex: 2, connected: true },
  { id: "cs4", name: "PagerDuty", detail: "Not connected", initials: "PD", avatarIndex: 3, connected: false },
  { id: "cs5", name: "Google Calendar", detail: "alex.morgan@acmecloud.com", initials: "GC", avatarIndex: 4, connected: true },
  { id: "cs6", name: "Slack", detail: "Not connected", initials: "SL", avatarIndex: 5, connected: false }
];

export const preferences = [
  { id: "pf1", title: "Compact layout", body: "Denser spacing across tables and lists", on: false },
  { id: "pf2", title: "Proactive AI suggestions", body: "Let agents surface insights on the dashboard", on: true },
  { id: "pf3", title: "Weekly email digest", body: "Summary of activity every Monday morning", on: true }
];
