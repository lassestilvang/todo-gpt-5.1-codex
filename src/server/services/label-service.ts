import { and, eq } from "drizzle-orm";

import { db, labels } from "@/server/db";
import { createAuditLogger, type AuditValue } from "@/server/services/audit-service";
import {
  CreateLabelInput,
  UpdateLabelInput,
  createLabelSchema,
  updateLabelSchema,
} from "@/schemas/label";

export class LabelServiceError extends Error {}

const auditLabel = createAuditLogger("label");

async function logLabelChange(
  action: "insert" | "update" | "delete",
  userId: string,
  labelId: string,
  payload: { previousValue?: AuditValue; newValue?: AuditValue }
) {
  await auditLabel({
    entityId: labelId,
    userId,
    action,
    previousValue: payload.previousValue,
    newValue: payload.newValue,
  });
}

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

  await logLabelChange("insert", userId, id, { newValue: payload });

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
  const current = await getLabel(userId, payload.id);

  await db
    .update(labels)
    .set({
      ...payload,
      updatedAt: new Date(),
    })
    .where(and(eq(labels.id, payload.id), eq(labels.userId, userId)));

  await logLabelChange("update", userId, payload.id, {
    previousValue: current,
    newValue: payload,
  });

  return getLabel(userId, payload.id);
}

export async function deleteLabel(userId: string, labelId: string) {
  const current = await getLabel(userId, labelId);
  await db
    .delete(labels)
    .where(and(eq(labels.id, labelId), eq(labels.userId, userId)));
  await logLabelChange("delete", userId, labelId, { previousValue: current });
}
