"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUserId } from "@/server/auth/session";
import {
  createLabel,
  deleteLabel,
  getLabels,
  updateLabel,
} from "@/server/services/label-service";
import { createLabelSchema, updateLabelSchema } from "@/schemas/label";

const createLabelInput = createLabelSchema;
const updateLabelInput = updateLabelSchema;

type CreateLabelValues = z.infer<typeof createLabelInput>;
type UpdateLabelValues = z.infer<typeof updateLabelInput>;

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
        : "Something went wrong while updating your labels.",
  };
}

export async function createLabelAction(values: CreateLabelValues) {
  try {
    const userId = await getCurrentUserId();
    const payload = createLabelInput.parse(values);
    const existing = await getLabels(userId);
    const hasName = existing.some(
      (label) => label.name.toLowerCase() === payload.name.toLowerCase()
    );
    if (hasName) {
      return { success: false as const, error: "Label name already exists" };
    }
    await createLabel(userId, payload);
    revalidateDashboardPaths();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateLabelAction(values: UpdateLabelValues) {
  try {
    const userId = await getCurrentUserId();
    const payload = updateLabelInput.parse(values);
    await updateLabel(userId, payload);
    revalidateDashboardPaths();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteLabelAction(labelId: string) {
  try {
    const userId = await getCurrentUserId();
    await deleteLabel(userId, labelId);
    revalidateDashboardPaths();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}
