import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { __setDbForTests, type Database } from "@/lib/db/client";
import {
  createUserAndOrg,
  listProjectTasks,
  getProjectTask,
  createProjectTask,
  moveProjectTask,
  updateProjectTask
} from "@/lib/db/queries";
import { organizations, users, memberships, projectTasks } from "@/lib/db/schema";
import { createTestDb } from "../helpers/testDb";

let testDb: Database;
let orgId: string;

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-only-encryption-key-do-not-use-in-prod";
  testDb = await createTestDb();
});

beforeEach(async () => {
  __setDbForTests(testDb);
  await testDb.delete(projectTasks);
  await testDb.delete(memberships);
  await testDb.delete(users);
  await testDb.delete(organizations);
  const { organization } = await createUserAndOrg({
    email: "owner@example.com",
    name: "Owner",
    passwordHash: "h",
    organizationName: "Acme"
  });
  orgId = organization.id;
});

describe("listProjectTasks", () => {
  it("seeds the demo board on first read and is idempotent after that", async () => {
    const first = await listProjectTasks(orgId, "order-platform");
    expect(first.length).toBeGreaterThan(0);

    const second = await listProjectTasks(orgId, "order-platform");
    expect(second).toHaveLength(first.length);
    expect(second.map((t) => t.ref)).toEqual(first.map((t) => t.ref));
  });

  it("does not seed projects other than the demo board", async () => {
    expect(await listProjectTasks(orgId, "data-platform")).toEqual([]);
  });

  it("scopes tasks to the organization", async () => {
    await listProjectTasks(orgId, "order-platform");
    const { organization: other } = await createUserAndOrg({
      email: "other@example.com",
      name: "Other",
      passwordHash: "h",
      organizationName: "Other Co"
    });
    // A second org seeds its own copy rather than seeing Acme's rows.
    const mine = await listProjectTasks(orgId, "order-platform");
    const theirs = await listProjectTasks(other.id, "order-platform");
    expect(theirs).toHaveLength(mine.length);
    expect(theirs.every((t) => t.organizationId === other.id)).toBe(true);
  });
});

describe("createProjectTask", () => {
  it("allocates the next sequential ref and appends to its column", async () => {
    await listProjectTasks(orgId, "order-platform");
    const created = await createProjectTask({
      organizationId: orgId,
      projectSlug: "order-platform",
      refPrefix: "NX",
      kind: "task",
      title: "Add rate limiting",
      status: "To Do",
      priority: "High",
      points: 5,
      assignee: "AM",
      avatarIndex: 0
    });

    expect(created.ref).toBe("NX-2142"); // continues from the highest seeded ref, NX-2141
    expect(created.status).toBe("To Do");

    const again = await createProjectTask({
      organizationId: orgId,
      projectSlug: "order-platform",
      refPrefix: "NX",
      kind: "bug",
      title: "Another",
      status: "To Do",
      priority: "Low",
      points: 1,
      assignee: "PN",
      avatarIndex: 1
    });
    expect(again.ref).toBe("NX-2143");
  });
});

describe("moveProjectTask", () => {
  it("changes status and persists the new position", async () => {
    await listProjectTasks(orgId, "order-platform");
    const moved = await moveProjectTask({ organizationId: orgId, ref: "NX-2119", status: "Done", position: 0 });
    expect(moved?.status).toBe("Done");
  });

  it("shifts siblings down so ordering survives a reload", async () => {
    await listProjectTasks(orgId, "order-platform");
    await moveProjectTask({ organizationId: orgId, ref: "NX-2119", status: "Done", position: 0 });

    const tasks = await listProjectTasks(orgId, "order-platform");
    const done = tasks.filter((t) => t.status === "Done").sort((a, b) => a.sortOrder - b.sortOrder);
    expect(done[0].ref).toBe("NX-2119");
    // Every position in the column is distinct — no collisions after the shift.
    expect(new Set(done.map((t) => t.sortOrder)).size).toBe(done.length);
  });

  it("returns undefined for a ref that does not exist", async () => {
    expect(await moveProjectTask({ organizationId: orgId, ref: "NOPE-1", status: "Done", position: 0 })).toBeUndefined();
  });
});

describe("nextTaskRef floor", () => {
  it("starts a brand-new project's tickets at 101", async () => {
    const created = await createProjectTask({
      organizationId: orgId,
      projectSlug: "billing-platform",
      refPrefix: "BILL",
      kind: "task",
      title: "Design invoice schema",
      status: "To Do",
      priority: "Med",
      points: 2,
      assignee: "DR",
      avatarIndex: 3
    });
    expect(created.ref).toBe("BILL-101");
  });
});

describe("updateProjectTask", () => {
  it("applies only the supplied fields", async () => {
    await listProjectTasks(orgId, "order-platform");
    const before = await getProjectTask(orgId, "NX-2140");

    const updated = await updateProjectTask({
      organizationId: orgId,
      ref: "NX-2140",
      title: "Renamed",
      status: "Done"
    });

    expect(updated?.title).toBe("Renamed");
    expect(updated?.status).toBe("Done");
    expect(updated?.priority).toBe(before?.priority);
    expect(updated?.points).toBe(before?.points);
  });
});
