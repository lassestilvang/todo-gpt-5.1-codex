import { and, desc, eq, gt, gte, lte, sql, type SQL } from "drizzle-orm";

import { db, reminders, subtasks, taskLabels, tasks } from "@/server/db";
import {
  AuditAction,
  AuditEntityType,
  createAuditLogger,
  type AuditValue,
} from "@/server/services/audit-service";
import {
  CreateTaskInput,
  UpdateTaskInput,
  createTaskSchema,
  updateTaskSchema,
} from "@/schemas/task";

export class TaskServiceError extends Error {}

const toMinutes = (value?: string | null) => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const audit = createAuditLogger("task");
async function recordAudit(
  entityType: AuditEntityType,
  entityId: string,
  userId: string,
  action: AuditAction,
  payload: {
    field?: string;
    previousValue?: AuditValue;
    newValue?: AuditValue;
    taskId?: string | null;
  }
) {
  return audit({
    entityId,
    userId,
    action,
    field: payload.field,
    previousValue: payload.previousValue,
    newValue: payload.newValue,
    taskId: payload.taskId ?? entityId,
  });
}

export async function listTasksByView(
  userId: string,
  view: "today" | "next7" | "upcoming" | "all"
) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfNextSeven = new Date(endOfToday);
  endOfNextSeven.setDate(endOfNextSeven.getDate() + 7);

  const filters: SQL<unknown>[] = [eq(tasks.userId, userId)];

  switch (view) {
    case "today":
      filters.push(gte(tasks.scheduledDate, startOfToday));
      filters.push(lte(tasks.scheduledDate, endOfToday));
      break;
    case "next7":
      filters.push(gte(tasks.scheduledDate, startOfToday));
      filters.push(lte(tasks.scheduledDate, endOfNextSeven));
      break;
    case "upcoming":
      filters.push(gt(tasks.scheduledDate, endOfToday));
      break;
    case "all":
    default:
      break;
  }

  let where: SQL<unknown> | undefined = filters[0];
  for (let i = 1; i < filters.length; i += 1) {
    where = where ? and(where, filters[i]) : filters[i];
  }

  const predicate = where ?? filters[0];

  return db
    .select()
    .from(tasks)
    .where(predicate)
    .orderBy(desc(tasks.updatedAt));
}

export async function getTask(userId: string, taskId: string) {
  const [result] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!result) {
    throw new TaskServiceError("Task not found");
  }

  return result;
}

async function syncLabels(taskId: string, labelIds?: string[]) {
  if (!labelIds) return;
  await db.delete(taskLabels).where(eq(taskLabels.taskId, taskId));
  if (labelIds.length === 0) return;
  await db.insert(taskLabels).values(
    labelIds.map((labelId) => ({
      taskId,
      labelId,
    }))
  );
}

type NormalizedSubtaskInput = Array<{
  id?: string;
  title: string;
  isDone?: boolean;
  orderIndex?: number;
}>;

type NormalizedReminderInput = Array<{
  id?: string;
  remindAt: string;
  channel: "in_app" | "email" | "push";
}>;

const normalizeSubtasks = (
  input?: CreateTaskInput["subtasks"] | UpdateTaskInput["subtasks"]
): NormalizedSubtaskInput | undefined => input?.map((item) => ({ ...item }));

const normalizeReminders = (
  input?: CreateTaskInput["reminders"] | UpdateTaskInput["reminders"]
): NormalizedReminderInput | undefined => input?.map((item) => ({ ...item }));

async function syncSubtasks(taskId: string, input?: NormalizedSubtaskInput) {
  if (!input) return;
  await db.delete(subtasks).where(eq(subtasks.taskId, taskId));
  if (!input.length) return;
  await db.insert(subtasks).values(
    input.map((subtask, index) => ({
      id: subtask.id ?? crypto.randomUUID(),
      taskId,
      title: subtask.title,
      isDone: subtask.isDone ?? false,
      orderIndex: subtask.orderIndex ?? index,
    }))
  );
}

async function syncReminders(taskId: string, input?: NormalizedReminderInput) {
  if (!input) return;
  await db.delete(reminders).where(eq(reminders.taskId, taskId));
  if (!input.length) return;
  await db.insert(reminders).values(
    input.map((reminder) => ({
      id: reminder.id ?? crypto.randomUUID(),
      taskId,
      remindAt: new Date(reminder.remindAt),
      channel: reminder.channel,
      status: "scheduled",
    }))
  );
}

export async function createTask(userId: string, input: CreateTaskInput) {
  const payload = createTaskSchema.parse(input);
  const id = crypto.randomUUID();
  const estimateMinutes =
    payload.estimateMinutes ?? toMinutes(payload.estimate);
  const actualMinutes = payload.actual ? toMinutes(payload.actual) : null;
  const labelIds = payload.labels;
  const subtaskInput = normalizeSubtasks(payload.subtasks);
  const reminderInput = normalizeReminders(payload.reminders);

  await db.insert(tasks).values({
    id,
    userId,
    listId: payload.listId,
    title: payload.title,
    description: payload.description,
    scheduledDate: payload.scheduledDate
      ? new Date(payload.scheduledDate)
      : null,
    deadline: payload.deadline ? new Date(payload.deadline) : null,
    priority: payload.priority,
    status: payload.status,
    estimateMinutes,
    actualMinutes: actualMinutes ?? undefined,
  });

  await syncLabels(id, labelIds);
  await syncSubtasks(id, subtaskInput);
  await syncReminders(id, reminderInput);

  await recordAudit("task", id, userId, "insert", {
    field: undefined,
    newValue: payload,
    taskId: id,
  });

  return getTask(userId, id);
}

export async function updateTask(userId: string, input: UpdateTaskInput) {
  const payload = updateTaskSchema.parse(input);
  const current = await getTask(userId, payload.id);
  const estimateMinutes = toMinutes(payload.estimate);
  const actualMinutes = payload.actual ? toMinutes(payload.actual) : undefined;
  const labelIds = payload.labels;
  const subtaskInput = normalizeSubtasks(payload.subtasks);
  const reminderInput = normalizeReminders(payload.reminders);

  await recordAudit("task", payload.id, userId, "update", {
    field: undefined,
    previousValue: current,
    newValue: payload,
    taskId: payload.id,
  });

  await db
    .update(tasks)
    .set({
      ...payload,
      scheduledDate: payload.scheduledDate
        ? new Date(payload.scheduledDate)
        : null,
      deadline: payload.deadline ? new Date(payload.deadline) : null,
      updatedAt: new Date(),
      estimateMinutes: estimateMinutes ?? current.estimateMinutes,
      actualMinutes: actualMinutes ?? current.actualMinutes,
    })
    .where(and(eq(tasks.id, payload.id), eq(tasks.userId, userId)));

  await syncLabels(payload.id, labelIds);
  await syncSubtasks(payload.id, subtaskInput);
  await syncReminders(payload.id, reminderInput);

  return getTask(userId, payload.id);
}

export async function deleteTask(userId: string, taskId: string) {
  const existing = await getTask(userId, taskId);
  await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  await recordAudit("task", taskId, userId, "delete", {
    field: undefined,
    previousValue: existing,
    taskId,
  });
}

function buildWhere(filters: SQL<unknown>[]) {
  if (filters.length === 0) {
    throw new Error("buildWhere requires at least one filter");
  }

  let predicate: SQL<unknown> = filters[0];
  for (let i = 1; i < filters.length; i += 1) {
    predicate = and(predicate, filters[i])!;
  }
  return predicate;
}

async function countWithFilters(filters: SQL<unknown>[]) {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(buildWhere(filters));
  return result?.count ?? 0;
}

export async function countTasksByView(userId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfNextSeven = new Date(endOfToday);
  endOfNextSeven.setDate(endOfNextSeven.getDate() + 7);

  const baseFilter = eq(tasks.userId, userId);

  const [today, next7, upcoming, all] = await Promise.all([
    countWithFilters([
      baseFilter,
      gte(tasks.scheduledDate, startOfToday),
      lte(tasks.scheduledDate, endOfToday),
    ]),
    countWithFilters([
      baseFilter,
      gte(tasks.scheduledDate, startOfToday),
      lte(tasks.scheduledDate, endOfNextSeven),
    ]),
    countWithFilters([baseFilter, gt(tasks.scheduledDate, endOfToday)]),
    countWithFilters([baseFilter]),
  ]);

  return { today, next7, upcoming, all } as const;
}

export async function countTasksPerList(userId: string) {
  const rows = await db
    .select({ listId: tasks.listId, count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .groupBy(tasks.listId);

  return rows.reduce<Record<string, number>>((acc, row) => {
    if (row.listId) {
      acc[row.listId] = row.count ?? 0;
    }
    return acc;
  }, {});
}

export async function countTasksPerLabel(userId: string) {
  const rows = await db
    .select({ labelId: taskLabels.labelId, count: sql<number>`count(*)` })
    .from(taskLabels)
    .innerJoin(tasks, eq(taskLabels.taskId, tasks.id))
    .where(eq(tasks.userId, userId))
    .groupBy(taskLabels.labelId);

  return rows.reduce<Record<string, number>>((acc, row) => {
    if (row.labelId) {
      acc[row.labelId] = row.count ?? 0;
    }
    return acc;
  }, {});
}
