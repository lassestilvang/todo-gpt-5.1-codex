import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";

import { db, ftsTasks, labels, lists, taskLabels, tasks } from "@/server/db";

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
const STREAM_BATCH_SIZE = 10;

export async function searchTasks(
  userId: string,
  query: string
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const ftsRows = await runFtsSearch(userId, trimmed);
  if (ftsRows.length) {
    return enrichWithLabels(userId, ftsRows);
  }

  const fallbackRows = await runStandardSearch(userId, trimmed);
  return fallbackRows.length ? enrichWithLabels(userId, fallbackRows) : [];
}

export async function* streamSearchResults(
  userId: string,
  query: string
): AsyncGenerator<SearchResult[], void> {
  const trimmed = query.trim();
  if (!trimmed) {
    return;
  }

  const ftsRows = await runFtsSearch(userId, trimmed);
  const source = ftsRows.length ? ftsRows : await runStandardSearch(userId, trimmed);
  const hydrated = await enrichWithLabels(userId, source);

  for (let i = 0; i < hydrated.length; i += STREAM_BATCH_SIZE) {
    yield hydrated.slice(i, i + STREAM_BATCH_SIZE);
  }
}

export async function* streamSearchTasks(
  userId: string,
  query: string
): AsyncGenerator<SearchResult, void> {
  for await (const batch of streamSearchResults(userId, query)) {
    for (const row of batch) {
      yield row;
    }
  }
}

type RawSearchRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  listName: string | null;
  listColor: string | null;
  matchRank: number;
};

async function runFtsSearch(userId: string, query: string): Promise<RawSearchRow[]> {
  try {
    const normalized = normalizeQuery(query);
    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        listName: lists.name,
        listColor: lists.color,
        matchRank: sql`bm25(${ftsTasks})`.as<number>(),
      })
      .from(ftsTasks)
      .innerJoin(tasks, eq(tasks.id, ftsTasks.taskId))
      .leftJoin(lists, eq(lists.id, tasks.listId))
      .where(
        and(
          eq(ftsTasks.userId, userId),
          sql`${ftsTasks} MATCH ${normalized}`
        )
      )
      .orderBy(sql`bm25(${ftsTasks})`)
      .limit(MAX_RESULTS);

    return rows.map(clampMatchRank);
  } catch (error) {
    if (isFtsUnavailableError(error)) {
      return [];
    }
    throw error;
  }
}

async function runStandardSearch(userId: string, query: string): Promise<RawSearchRow[]> {
  const wildcard = `%${query.replace(/\s+/g, "%")}%`;
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      listName: lists.name,
      listColor: lists.color,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(lists, eq(lists.id, tasks.listId))
    .where(
      and(
        eq(tasks.userId, userId),
        or(like(tasks.title, wildcard), like(tasks.description, wildcard))
      )
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(MAX_RESULTS);

  return rows.map((row, index) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    listName: row.listName,
    listColor: row.listColor,
    matchRank: Number(row.updatedAt?.valueOf() ?? 0) - index,
  }));
}

async function enrichWithLabels(userId: string, rows: RawSearchRow[]): Promise<SearchResult[]> {
  const ids = rows.map((row) => row.id);
  if (!ids.length) {
    return [];
  }

  const labelRows = await db
    .select({
      taskId: taskLabels.taskId,
      labelId: labels.id,
      labelName: labels.name,
      labelColor: labels.color,
    })
    .from(taskLabels)
    .innerJoin(labels, eq(labels.id, taskLabels.labelId))
    .where(and(eq(labels.userId, userId), inArray(taskLabels.taskId, ids)));

  const labelMap = new Map<string, SearchResult["labels"]>();
  for (const row of labelRows) {
    const bucket = labelMap.get(row.taskId) ?? [];
    bucket.push({ id: row.labelId, name: row.labelName, color: row.labelColor });
    labelMap.set(row.taskId, bucket);
  }

  return rows.map((row, index) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    listName: row.listName ?? null,
    listColor: row.listColor ?? null,
    priority: row.priority,
    labels: labelMap.get(row.id) ?? [],
    matchRank: row.matchRank - index * 0.001,
  }));
}

function clampMatchRank(row: RawSearchRow): RawSearchRow {
  return {
    ...row,
    matchRank: Number.isFinite(row.matchRank)
      ? row.matchRank
      : typeof row.matchRank === "string"
        ? Number(row.matchRank) || 0
        : 0,
  };
}

function normalizeQuery(query: string) {
  const sanitized = query
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => `${token}*`)
    .join(" ");
  return sanitized || query;
}

const FTS_MISMATCH_PATTERNS = [
  "datatype mismatch",
  "no such column",
  "no such function: bm25",
];

function isFtsUnavailableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message?: string }).message) : "";
  return (
    message.includes("fts_tasks") &&
    (message.includes("no such table") || message.includes("does not exist"))
  ) || FTS_MISMATCH_PATTERNS.some((pattern) => message.includes(pattern));
}
