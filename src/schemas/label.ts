import { z } from "zod";

const colorRegex = /^#([0-9a-fA-F]{3}){1,2}$/;

export const labelBaseSchema = z.object({
  name: z.string().min(1).max(64),
  emoji: z.string().min(1).max(4).optional(),
  color: z.string().regex(colorRegex).default("#10b981"),
});

export const createLabelSchema = labelBaseSchema;

export const updateLabelSchema = labelBaseSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
