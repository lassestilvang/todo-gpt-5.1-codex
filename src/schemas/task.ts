import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().datetime().optional();
const hhmmRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

const priorityEnum = z.enum(["high", "medium", "low", "none"]);
const statusEnum = z.enum(["pending", "in_progress", "completed", "archived"]);
const recurrencePresetEnum = z.enum([
  "daily",
  "weekly",
  "weekday",
  "monthly",
  "yearly",
  "custom",
]);

export const subtaskSchema = z.object({
  id: uuid.optional(),
  title: z.string().min(1),
  isDone: z.boolean().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
});

export const reminderSchema = z.object({
  id: uuid.optional(),
  remindAt: z.string().datetime(),
  channel: z.enum(["in_app", "email", "push"]).default("in_app"),
});

export const attachmentSchema = z.object({
  id: uuid.optional(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

export const recurrenceSchema = z.object({
  preset: recurrencePresetEnum.default("daily"),
  rrule: z.string().optional(),
  timezone: z.string().optional(),
});

export const taskBaseSchema = z.object({
  title: z.string().min(1).max(280),
  description: z.string().max(4000).optional(),
  scheduledDate: isoDate,
  deadline: isoDate,
  estimate: z.string().regex(hhmmRegex).optional(),
  actual: z.string().regex(hhmmRegex).optional(),
  priority: priorityEnum.default("none"),
  status: statusEnum.default("pending"),
  listId: uuid,
  labels: z.array(uuid).optional(),
  reminders: z.array(reminderSchema).optional(),
  subtasks: z.array(subtaskSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
  recurrence: recurrenceSchema.optional(),
});

export const createTaskSchema = taskBaseSchema.extend({
  estimateMinutes: z.number().int().nonnegative().optional(),
});

export const updateTaskSchema = taskBaseSchema.partial().extend({
  id: uuid,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
