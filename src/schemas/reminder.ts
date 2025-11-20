import { z } from "zod";

export const reminderChannelEnum = z.enum(["in_app", "email", "push"]);
export const reminderStatusEnum = z.enum([
  "scheduled",
  "sent",
  "snoozed",
  "cancelled",
]);

export const reminderBaseSchema = z.object({
  remindAt: z.string().datetime(),
  channel: reminderChannelEnum.default("in_app"),
});

export const createReminderSchema = reminderBaseSchema.extend({
  taskId: z.string().uuid(),
});

export const updateReminderSchema = reminderBaseSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
