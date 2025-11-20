import { and, eq } from "drizzle-orm";

import { db, labels } from "@/server/db";
import {
  CreateLabelInput,
  UpdateLabelInput,
  createLabelSchema,
  updateLabelSchema,
} from "@/schemas/label";

export class LabelServiceError extends Error {}

export async function getLabels(userId: string) {
  return db.select().from(labels).where(eq(labels.userId, userId));
}

export async function createLabel(userId: string, input: CreateLabelInput) {
  const payload = createLabelSchema.parse(input);

  const existing = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.userId, userId), eq(labels.name, payload.name)))
    .limit(1);

  if (existing.length) {
    throw new LabelServiceError("Label name already exists");
  }

  const id = crypto.randomUUID();

  await db.insert(labels).values({
    id,
    userId,
    ...payload,
  });

  return getLabel(userId, id);
}

export async function getLabel(userId: string, labelId: string) {
  const [result] = await db
    .select()
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.userId, userId)))
    .limit(1);

  if (!result) {
    throw new LabelServiceError("Label not found");
  }

  return result;
}

export async function updateLabel(userId: string, input: UpdateLabelInput) {
  const payload = updateLabelSchema.parse(input);
  await getLabel(userId, payload.id);

  await db
    .update(labels)
    .set({
      ...payload,
      updatedAt: new Date(),
    })
    .where(and(eq(labels.id, payload.id), eq(labels.userId, userId)));

  return getLabel(userId, payload.id);
}

export async function deleteLabel(userId: string, labelId: string) {
  await getLabel(userId, labelId);
  await db
    .delete(labels)
    .where(and(eq(labels.id, labelId), eq(labels.userId, userId)));
}
