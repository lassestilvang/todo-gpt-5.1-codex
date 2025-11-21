import { eq, and } from "drizzle-orm";
import crypto from "crypto";

import { db, lists } from "@/server/db";
import { createAuditLogger, type AuditValue } from "@/server/services/audit-service";
import {
  CreateListInput,
  UpdateListInput,
  createListSchema,
  updateListSchema,
} from "@/schemas/list";

export class ListServiceError extends Error {}

const auditList = createAuditLogger("list");

async function logListChange(
  action: "insert" | "update" | "delete",
  userId: string,
  listId: string,
  payload: { previousValue?: AuditValue; newValue?: AuditValue }
) {
  await auditList({
    entityId: listId,
    userId,
    action,
    previousValue: payload.previousValue,
    newValue: payload.newValue,
  });
}

function assertNotSystem(list: typeof lists.$inferSelect) {
  if (list.isSystem) {
    throw new ListServiceError("Cannot modify system list");
  }
}

export async function getListsByUser(userId: string) {
  return db
    .select()
    .from(lists)
    .where(eq(lists.userId, userId))
    .orderBy(lists.sortOrder);
}

export async function getListById(userId: string, listId: string) {
  const [result] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
    .limit(1);

  if (!result) {
    throw new ListServiceError("List not found");
  }

  return result;
}

export async function createList(userId: string, input: CreateListInput) {
  const payload = createListSchema.parse(input);
  const id = crypto.randomUUID();

  await db.insert(lists).values({
    id,
    userId,
    ...payload,
  });

  await logListChange("insert", userId, id, { newValue: payload });

  return getListById(userId, id);
}

export async function updateList(userId: string, input: UpdateListInput) {
  const payload = updateListSchema.parse(input);
  const current = await getListById(userId, payload.id);
  assertNotSystem(current);

  await db
    .update(lists)
    .set({
      ...payload,
      updatedAt: new Date(),
    })
    .where(and(eq(lists.id, payload.id), eq(lists.userId, userId)));

  await logListChange("update", userId, payload.id, {
    previousValue: current,
    newValue: payload,
  });

  return getListById(userId, payload.id);
}

export async function deleteList(userId: string, listId: string) {
  const current = await getListById(userId, listId);
  assertNotSystem(current);
  await db
    .delete(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  await logListChange("delete", userId, listId, { previousValue: current });
}
