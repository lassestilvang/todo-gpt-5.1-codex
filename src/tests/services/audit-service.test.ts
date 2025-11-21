import { beforeEach, describe, expect, it } from "bun:test";

import { db, taskChangeLog } from "@/server/db";
import { AuditService } from "@/server/services/audit-service";

const RESET_TABLE_SQL = `
  DELETE FROM task_change_log;
`;

const audit = AuditService.withDb(db);

describe("AuditService", () => {
  beforeEach(async () => {
    await db.run(RESET_TABLE_SQL);
  });

  it("records insert events with payloads", async () => {
    await audit.recordChange({
      entityType: "task",
      entityId: "task-1",
      userId: "user-1",
      action: "insert",
      field: "task",
      newValue: { id: "task-1", title: "Example" },
    });

    const rows = await db.select().from(taskChangeLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityType: "task",
      entityId: "task-1",
      changedBy: "user-1",
      action: "insert",
      taskId: "task-1",
    });
  });

  it("skips identical previous/new values by default", async () => {
    await audit.recordChange({
      entityType: "task",
      entityId: "task-2",
      userId: "user-1",
      action: "update",
      previousValue: { title: "A" },
      newValue: { title: "A" },
    });

    const rows = await db.select().from(taskChangeLog);
    expect(rows).toHaveLength(0);
  });

  it("allows redundant rows when skipRedundant is false", async () => {
    await audit.recordChange({
      entityType: "task",
      entityId: "task-2",
      userId: "user-1",
      action: "update",
      previousValue: { title: "A" },
      newValue: { title: "A" },
      skipRedundant: false,
    });

    const rows = await db.select().from(taskChangeLog);
    expect(rows).toHaveLength(1);
  });

  it("records bulk changes and resolves task id", async () => {
    await audit.recordBulkChanges({
      entityType: "reminder",
      entityId: "rem-1",
      userId: "user-1",
      action: "update",
      changes: [
        {
          field: "remindAt",
          previousValue: { taskId: "task-3", remindAt: "2024-01-01" },
          newValue: { taskId: "task-3", remindAt: "2024-02-01" },
        },
      ],
    });

    const rows = await db.select().from(taskChangeLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ taskId: "task-3", entityType: "reminder" });
  });

  it("fetches task and entity history", async () => {
    await audit.recordChange({
      entityType: "task",
      entityId: "task-4",
      userId: "user-2",
      action: "insert",
      newValue: { id: "task-4" },
    });
    await audit.recordChange({
      entityType: "task",
      entityId: "task-4",
      userId: "user-2",
      action: "update",
      newValue: { id: "task-4", title: "new" },
    });

    const taskHistory = await audit.getTaskHistory("task-4");
    expect(taskHistory).toHaveLength(2);

    const entityHistory = await audit.getEntityHistory("task", "task-4");
    expect(entityHistory).toHaveLength(2);
  });
});
