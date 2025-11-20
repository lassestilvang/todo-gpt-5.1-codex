import { and, desc, eq, gt, gte, lte, type SQL } from "drizzle-orm";

import {
  db,
  reminders,
  subtasks,
  taskChangeLog,
  taskLabels,
  tasks,
} from "@/server/db";
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

function recordChange(
  taskId: string,
  field: string,
  previousValue: unknown,
  newValue: unknown,
  userId: string
) {
  if (JSON.stringify(previousValue) === JSON.stringify(newValue)) return;
  return db
    .insert(taskChangeLog)
    .values({
      id: crypto.randomUUID(),
      taskId,
      changedBy: userId,
      field,
      previousValue: previousValue ? JSON.stringify(previousValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    })
    .execute();
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

  return db.select().from(tasks).where(predicate).orderBy(desc(tasks.updatedAt));
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

  await recordChange(payload.id, "task", current, payload, userId);

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
  await getTask(userId, taskId);
  await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}
