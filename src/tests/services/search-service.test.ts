import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

let db: (typeof import("@/server/db"))["db"];
let searchTasks: (typeof import("@/server/services/search-service"))["searchTasks"];
let streamSearchTasks: (typeof import("@/server/services/search-service"))["streamSearchTasks"];
let streamSearchResults: (typeof import("@/server/services/search-service"))["streamSearchResults"];

const sqliteAvailable = await detectSqliteSupport();

if (!sqliteAvailable) {
  console.warn(
    "Skipping search-service tests because better-sqlite3 and bun:sqlite are unavailable."
  );
}

const describeIfSqlite = sqliteAvailable ? describe : describe.skip;

const TEST_DB_DIR = join(process.cwd(), "tmp");
const TEST_DB_PATH = join(TEST_DB_DIR, "search-service.test.sqlite");

process.env.DATABASE_URL = TEST_DB_PATH;

beforeAll(async () => {
  if (!sqliteAvailable) {
    return;
  }

  ensureDir(TEST_DB_DIR);
  if (existsSync(TEST_DB_PATH)) {
    rmSync(TEST_DB_PATH);
  }

  ({ db } = await import("@/server/db"));
  ({ searchTasks, streamSearchTasks, streamSearchResults } = await import(
    "@/server/services/search-service"
  ));
});

beforeEach(async () => {
  if (!sqliteAvailable) {
    return;
  }

  await resetDb();
});

const describeOrSkip = (description: string, fn: () => void) =>
  describeIfSqlite(description, fn);

describeOrSkip("search-service", () => {
  const testFn = (sqliteAvailable ? it : it.skip) as typeof it;

  testFn("returns ranked FTS matches and streams them", async () => {
    await seedTask();

    const results = await searchTasks("user-1", "ship");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "task-1",
      title: "Ship release",
      listName: "Inbox",
    });
    expect(results[0].labels).toEqual([
      expect.objectContaining({ id: "label-1", name: "Risk" }),
    ]);

    const streamed: typeof results = [];
    for await (const row of streamSearchTasks("user-1", "ship")) {
      streamed.push(row);
    }

    expect(streamed).toEqual(results);
  });

  testFn(
    "falls back to LIKE queries when the FTS table is unavailable",
    async () => {
      await seedTask({ includeFtsRow: false });
      await db.run("DROP TABLE IF EXISTS fts_tasks;");

      const results = await searchTasks("user-1", "ship");
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ id: "task-1", title: "Ship release" });
      expect(results[0].labels).toHaveLength(1);
    }
  );

  testFn("streamSearchResults yields batches", async () => {
    await seedManyTasks(12);

    const batches: string[][] = [];
    for await (const batch of streamSearchResults("user-1", "Ship")) {
      batches.push(batch.map((row) => row.id));
    }

    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toHaveLength(12);
    expect(new Set(batches.flat()).size).toBe(12);
  });
});

async function resetDb() {
  const dropStatements = [
    "DROP TABLE IF EXISTS task_labels;",
    "DROP TABLE IF EXISTS labels;",
    "DROP TABLE IF EXISTS tasks;",
    "DROP TABLE IF EXISTS lists;",
    "DROP TABLE IF EXISTS fts_tasks;",
  ];

  for (const stmt of dropStatements) {
    await db.run(stmt);
  }

  const createStatements = [
    `CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      list_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT,
      updated_at INTEGER
    );`,
    `CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS task_labels (
      task_id TEXT NOT NULL,
      label_id TEXT NOT NULL
    );`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS fts_tasks USING fts5(
      task_id UNINDEXED,
      user_id UNINDEXED,
      list_id UNINDEXED,
      title,
      description,
      list_name,
      list_color,
      labels,
      priority,
      tokenize = 'porter'
    );`,
  ];

  for (const stmt of createStatements) {
    await db.run(stmt);
  }
}

async function seedTask(options?: { includeFtsRow?: boolean }) {
  const includeFtsRow = options?.includeFtsRow ?? true;
  await db.run(
    "INSERT INTO lists (id, user_id, name, color) VALUES ('list-1', 'user-1', 'Inbox', '#ffffff');"
  );
  await db.run(
    "INSERT INTO tasks (id, user_id, list_id, title, description, priority, updated_at) VALUES ('task-1', 'user-1', 'list-1', 'Ship release', 'Finish launch checklist', 'high', strftime('%s','now'));"
  );
  await db.run(
    "INSERT INTO labels (id, user_id, name, color) VALUES ('label-1', 'user-1', 'Risk', '#f87171');"
  );
  await db.run(
    "INSERT INTO task_labels (task_id, label_id) VALUES ('task-1', 'label-1');"
  );

  if (includeFtsRow) {
    await db.run(
      "INSERT INTO fts_tasks (task_id, user_id, list_id, title, description, list_name, list_color, labels, priority) VALUES ('task-1', 'user-1', 'list-1', 'Ship release', 'Finish launch checklist', 'Inbox', '#ffffff', 'Risk', 'high');"
    );
  }
}

async function seedManyTasks(count: number) {
  await db.run(
    "INSERT INTO lists (id, user_id, name, color) VALUES ('list-1', 'user-1', 'Inbox', '#ffffff');"
  );

  for (let index = 0; index < count; index += 1) {
    const taskId = `task-${index + 1}`;
    const title = `Ship item ${index + 1}`;
    await db.run(
      `INSERT INTO tasks (id, user_id, list_id, title, description, priority, updated_at) VALUES ('${taskId}', 'user-1', 'list-1', '${title}', 'desc', 'normal', strftime('%s','now'));`
    );
    await db.run(
      `INSERT INTO fts_tasks (task_id, user_id, list_id, title, description, list_name, list_color, labels, priority) VALUES ('${taskId}', 'user-1', 'list-1', '${title}', 'desc', 'Inbox', '#ffffff', 'Ops', 'normal');`
    );
  }
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function detectSqliteSupport() {
  const candidates = ["better-sqlite3", "bun:sqlite"];

  for (const candidate of candidates) {
    try {
      await import(candidate);
      return true;
    } catch {
      // Continue to the next candidate.
    }
  }

  return false;
}
