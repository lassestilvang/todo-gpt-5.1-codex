import { and, desc, eq, inArray, like, or } from "drizzle-orm";

import { db, labels, lists, taskLabels, tasks } from "@/server/db";

export type SearchResult = {
  id: string;
  title: string;
  description: string | null;
  listName: string | null;
  listColor: string | null;
  labels: Array<{ id: string; name: string; color: string | null }>;
  priority: string | null;
  matchRank: number;
};

const MAX_RESULTS = 25;

export async function searchTasks(userId: string, query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const wildcard = `%${trimmed.replace(/\s+/g, "%")}%`;

  const baseRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      updatedAt: tasks.updatedAt,
      listName: lists.name,
      listColor: lists.color,
    })
    .from(tasks)
    .leftJoin(lists, eq(lists.id, tasks.listId))
    .where(
      and(
        eq(tasks.userId, userId),
        or(like(tasks.title, wildcard), like(tasks.description, wildcard ?? "%"))
      )
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(MAX_RESULTS);

  const taskIds = baseRows.map((row) => row.id);
  if (!taskIds.length) return [];

  const labelRows = await db
    .select({
      taskId: taskLabels.taskId,
      labelId: labels.id,
      name: labels.name,
      color: labels.color,
    })
    .from(taskLabels)
    .innerJoin(labels, eq(labels.id, taskLabels.labelId))
    .where(and(eq(labels.userId, userId), inArray(taskLabels.taskId, taskIds)));

  const labelMap = new Map<string, SearchResult["labels"]>();
  labelRows.forEach((row) => {
    const bucket = labelMap.get(row.taskId) ?? [];
    bucket.push({ id: row.labelId, name: row.name, color: row.color });
    labelMap.set(row.taskId, bucket);
  });

  return baseRows.map((row, index) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    listName: row.listName ?? null,
    listColor: row.listColor ?? null,
    labels: labelMap.get(row.id) ?? [],
    matchRank: Number(row.updatedAt?.valueOf() ?? 0) - index,
  }));
}
