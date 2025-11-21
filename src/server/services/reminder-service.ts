import { and, eq, gte, lt } from "drizzle-orm";

import { db, reminders, tasks } from "@/server/db";
import { createAuditLogger, type AuditValue } from "@/server/services/audit-service";
import {
  CreateReminderInput,
  UpdateReminderInput,
  createReminderSchema,
  updateReminderSchema,
} from "@/schemas/reminder";

export class ReminderServiceError extends Error {}

const auditReminder = createAuditLogger("reminder");

async function logReminderChange(
  action: "insert" | "update" | "delete",
  userId: string,
  reminderId: string,
  taskId: string,
  payload: { previousValue?: AuditValue; newValue?: AuditValue }
) {
  await auditReminder({
    entityId: reminderId,
    taskId,
    userId,
    action,
    previousValue: payload.previousValue,
    newValue: payload.newValue,
  });
}

export async function listRemindersForTask(userId: string, taskId: string) {
  await assertTaskOwnership(userId, taskId);
  return db.select().from(reminders).where(eq(reminders.taskId, taskId));
}

export async function createReminder(
  userId: string,
  input: CreateReminderInput
) {
  const payload = createReminderSchema.parse(input);
  await assertTaskOwnership(userId, payload.taskId);

  const id = crypto.randomUUID();
  await db.insert(reminders).values({
    id,
    taskId: payload.taskId,
    remindAt: new Date(payload.remindAt),
    channel: payload.channel,
    status: "scheduled",
  });

  await logReminderChange("insert", userId, id, payload.taskId, {
    newValue: payload,
  });

  return getReminder(userId, id);
}

export async function getReminder(userId: string, reminderId: string) {
  const [row] = await db
    .select({
      reminder: reminders,
      taskUser: tasks.userId,
    })
    .from(reminders)
    .innerJoin(tasks, eq(tasks.id, reminders.taskId))
    .where(eq(reminders.id, reminderId))
    .limit(1);

  if (!row || row.taskUser !== userId) {
    throw new ReminderServiceError("Reminder not found");
  }

  return row.reminder;
}

export async function updateReminder(
  userId: string,
  input: UpdateReminderInput
) {
  const payload = updateReminderSchema.parse(input);
  const reminder = await getReminder(userId, payload.id);

  await db
    .update(reminders)
    .set({
      ...payload,
      remindAt: payload.remindAt
        ? new Date(payload.remindAt)
        : reminder.remindAt,
      updatedAt: new Date(),
    })
    .where(eq(reminders.id, payload.id));

  await logReminderChange("update", userId, payload.id, reminder.taskId, {
    previousValue: reminder,
    newValue: payload,
  });

  return getReminder(userId, payload.id);
}

export async function deleteReminder(userId: string, reminderId: string) {
  const reminder = await getReminder(userId, reminderId);
  await db.delete(reminders).where(eq(reminders.id, reminderId));
  await logReminderChange("delete", userId, reminderId, reminder.taskId, {
    previousValue: reminder,
  });
}

export async function fetchDueReminders(windowMinutes = 5) {
  const now = new Date();
  const horizon = new Date(now.getTime() + windowMinutes * 60 * 1000);

  return db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.status, "scheduled"),
        gte(reminders.remindAt, now),
        lt(reminders.remindAt, horizon)
      )
    );
}

export async function markReminderSent(reminderId: string) {
  await db
    .update(reminders)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(reminders.id, reminderId));
}

export async function snoozeReminder(reminderId: string, minutes: number) {
  const [row] = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, reminderId));
  if (!row) throw new ReminderServiceError("Reminder not found");

  const nextTime = new Date(row.remindAt.getTime() + minutes * 60 * 1000);
  await db
    .update(reminders)
    .set({
      remindAt: nextTime,
      status: "snoozed",
      snoozeCount: (row.snoozeCount ?? 0) + 1,
    })
    .where(eq(reminders.id, reminderId));
}

async function assertTaskOwnership(userId: string, taskId: string) {
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!row) {
    throw new ReminderServiceError("Task not found");
  }
}
