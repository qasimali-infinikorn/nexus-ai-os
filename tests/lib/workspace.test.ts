import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { __setDbForTests, type Database } from "@/lib/db/client";
import { createUserAndOrg } from "@/lib/db/queries";
import {
  createAgentRun,
  createDeployment,
  createIncident,
  createMeeting,
  createNotification,
  finishAgentRun,
  getDashboardStats,
  getAgentRunStats,
  getPlatformAgentRunStats,
  listNotificationsForUser,
  markAllNotificationsRead,
  countOpenIncidents
} from "@/lib/db/workspace";
import {
  agentRuns,
  auditLog,
  deployments,
  featureFlagTenants,
  featureFlags,
  incidents,
  invitations,
  meetingActionItems,
  meetings,
  memberships,
  notifications,
  orgCustomAgents,
  organizations,
  projectTasks,
  projects,
  userOauthConnections,
  userSettings,
  users
} from "@/lib/db/schema";
import { createTestDb } from "../helpers/testDb";
import { saveUserSettings } from "@/lib/db/queries";
import { createOrgCustomAgent, getOrgCustomAgent } from "@/lib/db/custom-agents";

let testDb: Database;

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-only-encryption-key-do-not-use-in-prod";
  testDb = await createTestDb();
});

beforeEach(async () => {
  __setDbForTests(testDb);
  await testDb.delete(meetingActionItems);
  await testDb.delete(meetings);
  await testDb.delete(notifications);
  await testDb.delete(agentRuns);
  await testDb.delete(deployments);
  await testDb.delete(incidents);
  await testDb.delete(projectTasks);
  await testDb.delete(projects);
  await testDb.delete(orgCustomAgents);
  await testDb.delete(userOauthConnections);
  await testDb.delete(userSettings);
  await testDb.delete(featureFlagTenants);
  await testDb.delete(featureFlags);
  await testDb.delete(auditLog);
  await testDb.delete(invitations);
  await testDb.delete(memberships);
  await testDb.delete(users);
  await testDb.delete(organizations);
});

describe("Phase 2 workspace data", () => {
  it("stores notifications and marks them read", async () => {
    const { organization, user } = await createUserAndOrg({
      email: "n@example.com",
      name: "N",
      passwordHash: "h",
      organizationName: "Notify Co"
    });

    await createNotification({
      organizationId: organization.id,
      userId: user.id,
      kind: "Mentions",
      title: "You were mentioned",
      body: "On NX-1",
      href: "/projects"
    });
    await createNotification({
      organizationId: organization.id,
      kind: "Incidents",
      title: "Org-wide alert",
      body: "Sev1",
      href: "/devops",
      tone: "red"
    });

    const list = await listNotificationsForUser({
      organizationId: organization.id,
      userId: user.id
    });
    expect(list).toHaveLength(2);
    expect(list.every((n) => n.unread)).toBe(true);

    const marked = await markAllNotificationsRead(organization.id, user.id);
    expect(marked).toBe(2);
    const after = await listNotificationsForUser({
      organizationId: organization.id,
      userId: user.id
    });
    expect(after.every((n) => !n.unread)).toBe(true);
  });

  it("tracks agent runs and dashboard stats", async () => {
    const { organization, user } = await createUserAndOrg({
      email: "a@example.com",
      name: "A",
      passwordHash: "h",
      organizationName: "Agent Co"
    });

    const run = await createAgentRun({
      organizationId: organization.id,
      userId: user.id,
      agentType: "eng_lead",
      provider: "openai",
      model: "gpt-4o",
      prompt: "Review this PR"
    });
    await finishAgentRun({
      id: run.id,
      organizationId: organization.id,
      status: "succeeded",
      resultExcerpt: "Looks good"
    });

    await createMeeting({
      organizationId: organization.id,
      title: "Standup",
      startsAt: new Date()
    });

    await createIncident({
      organizationId: organization.id,
      code: "INC-1",
      title: "API latency",
      severity: "high"
    });

    const stats = await getAgentRunStats(organization.id);
    expect(stats.total).toBe(1);
    expect(stats.last7d).toBe(1);
    expect(stats.thisMonth).toBe(1);
    expect(stats.succeeded).toBe(1);
    expect(stats.failed).toBe(0);

    const dash = await getDashboardStats(organization.id, user.id);
    expect(dash.meetingsToday).toBe(1);
    expect(dash.openIncidents).toBe(1);
    expect(dash.agentRuns7d).toBe(1);

    const platform = await getPlatformAgentRunStats();
    expect(platform.runs7d).toBeGreaterThanOrEqual(1);
    expect(platform.succeeded7d).toBeGreaterThanOrEqual(1);
    expect(platform.byAgent7d.some((r) => r.agentType === "eng_lead")).toBe(true);
  });

  it("records deployments and open incident counts", async () => {
    const { organization } = await createUserAndOrg({
      email: "d@example.com",
      name: "D",
      passwordHash: "h",
      organizationName: "Deploy Co"
    });

    await createDeployment({
      organizationId: organization.id,
      service: "api",
      version: "v1.2.3",
      status: "success"
    });
    await createIncident({
      organizationId: organization.id,
      code: "INC-9",
      title: "Disk full",
      severity: "critical"
    });

    expect(await countOpenIncidents(organization.id)).toBe(1);
  });

  it("skips in-app notification when the user disabled that prefs event", async () => {
    const { organization, user } = await createUserAndOrg({
      email: "prefs@example.com",
      name: "P",
      passwordHash: "h",
      organizationName: "Prefs Co"
    });

    await saveUserSettings({
      userId: user.id,
      organizationId: organization.id,
      notificationPrefs: {
        agent_runs: { inApp: false, email: false, slack: false }
      }
    });

    const skipped = await createNotification({
      organizationId: organization.id,
      userId: user.id,
      kind: "Agents",
      title: "Agent done",
      body: "ok"
    });
    expect(skipped).toBeNull();

    const kept = await createNotification({
      organizationId: organization.id,
      userId: user.id,
      kind: "Mentions",
      title: "Hi",
      body: "there"
    });
    expect(kept).not.toBeNull();
  });

  it("still skips the inbox row when only email is enabled for the event", async () => {
    const { organization, user } = await createUserAndOrg({
      email: "email-only@example.com",
      name: "E",
      passwordHash: "h",
      organizationName: "Email Co"
    });

    await saveUserSettings({
      userId: user.id,
      organizationId: organization.id,
      notificationPrefs: {
        agent_runs: { inApp: false, email: true, slack: false }
      }
    });

    const row = await createNotification({
      organizationId: organization.id,
      userId: user.id,
      kind: "Agents",
      title: "Agent done",
      body: "ok"
    });
    expect(row).toBeNull();
  });

  it("creates org custom agents with unique keys", async () => {
    const { organization, user } = await createUserAndOrg({
      email: "ca@example.com",
      name: "C",
      passwordHash: "h",
      organizationName: "Custom Co"
    });

    const a = await createOrgCustomAgent({
      organizationId: organization.id,
      createdByUserId: user.id,
      name: "Security Reviewer",
      description: "Looks for OWASP issues in diffs.",
      systemPrompt: "You are a security specialist. Focus on injection, authz, and secrets."
    });
    expect(a.key).toBe("custom_security_reviewer");

    const found = await getOrgCustomAgent(organization.id, a.key);
    expect(found?.name).toBe("Security Reviewer");
  });
});
