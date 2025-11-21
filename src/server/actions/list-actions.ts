"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUserId } from "@/server/auth/session";
import {
  createList,
  deleteList,
  getListsByUser,
  updateList,
} from "@/server/services/list-service";
import { listBaseSchema, updateListSchema } from "@/schemas/list";

const createListInput = listBaseSchema;
const updateListInput = updateListSchema;

type CreateListValues = z.infer<typeof createListInput>;
type UpdateListValues = z.infer<typeof updateListInput>;

function revalidateDashboardPaths() {
  const paths = ["/", "/today", "/next7", "/upcoming", "/all"] as const;
  paths.forEach((path) => revalidatePath(path));
  revalidatePath("/", "layout");
}

function actionError(error: unknown) {
  return {
    success: false as const,
    error:
      error instanceof Error
        ? error.message
        : "Something went wrong while updating your lists.",
  };
}

export async function createListAction(values: CreateListValues) {
  try {
    const userId = await getCurrentUserId();
    const payload = createListInput.parse(values);
    const existing = await getListsByUser(userId);
    const nextSortOrder =
      existing.reduce((max, list) => Math.max(max, list.sortOrder ?? 0), 0) + 1;
    await createList(userId, { ...payload, sortOrder: nextSortOrder });
    revalidateDashboardPaths();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateListAction(values: UpdateListValues) {
  try {
    const userId = await getCurrentUserId();
    const payload = updateListInput.parse(values);
    await updateList(userId, payload);
    revalidateDashboardPaths();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteListAction(listId: string) {
  try {
    const userId = await getCurrentUserId();
    await deleteList(userId, listId);
    revalidateDashboardPaths();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}
