"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUserId } from "@/server/auth/session";
import { createTask } from "@/server/services/task-service";
import { getListsByUser } from "@/server/services/list-service";

const createQuickTaskInput = z.object({
  title: z.string().min(1).max(280),
  view: z.enum(["today", "next", "upcoming", "all"]),
});

type CreateQuickTaskValues = z.infer<typeof createQuickTaskInput>;

function revalidateDashboardPaths() {
  const paths = ["/", "/today", "/next", "/upcoming", "/all"] as const;
  paths.forEach((path) => revalidatePath(path));
  revalidatePath("/", "layout");
}

function actionError(error: unknown) {
  return {
    success: false as const,
    error:
      error instanceof Error
        ? error.message
        : "Something went wrong while updating your tasks.",
  };
}

export async function createQuickTaskAction(values: CreateQuickTaskValues) {
  try {
    const userId = await getCurrentUserId();
    const payload = createQuickTaskInput.parse(values);

    const lists = await getListsByUser(userId);
    const defaultList = lists[0];

    if (!defaultList) {
      return {
        success: false as const,
        error: "Create a list before adding tasks.",
      };
    }

    const now = new Date();
    now.setSeconds(0, 0);

    let scheduledDate: string | undefined;

    switch (payload.view) {
      case "today": {
        scheduledDate = now.toISOString();
        break;
      }
      case "next": {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        scheduledDate = d.toISOString();
        break;
      }
      case "upcoming": {
        const d = new Date(now);
        d.setDate(d.getDate() + 8);
        scheduledDate = d.toISOString();
        break;
      }
      case "all":
      default: {
        scheduledDate = undefined;
        break;
      }
    }

    await createTask(userId, {
      title: payload.title,
      description: undefined,
      scheduledDate,
      deadline: undefined,
      estimate: undefined,
      actual: undefined,
      priority: "none",
      status: "pending",
      listId: defaultList.id,
      labels: [],
      reminders: [],
      subtasks: [],
      attachments: [],
      recurrence: undefined,
      estimateMinutes: undefined,
    });

    revalidateDashboardPaths();

    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}
