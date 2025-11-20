import { z } from "zod";

const colorRegex = /^#([0-9a-fA-F]{3}){1,2}$/;

export const listBaseSchema = z.object({
  name: z.string().min(1).max(120),
  emoji: z.string().min(1).max(4).optional(),
  color: z.string().regex(colorRegex).default("#6366f1"),
});

export const createListSchema = listBaseSchema.extend({
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateListSchema = listBaseSchema.partial().extend({
  id: z.string().uuid(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
