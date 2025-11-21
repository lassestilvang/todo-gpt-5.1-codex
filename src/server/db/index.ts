import { createRequire } from "node:module";
import type Database from "better-sqlite3";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleBunSqlite } from "drizzle-orm/bun-sqlite";

import { env } from "@/lib/env";
import * as schema from "./schema";

const sqlite = resolveDatabase();

export const db =
  sqlite.kind === "better"
    ? drizzleBetterSqlite(sqlite.client, { schema })
    : drizzleBunSqlite(sqlite.path, { schema });
export * from "./schema";

type SqliteResult =
  | { kind: "better"; client: Database }
  | { kind: "bun"; path: string };

function resolveDatabase(): SqliteResult {
  const requireFn = createRequire(import.meta.url);
  try {
    // Prefer native better-sqlite3 when available
    const betterSqlite = requireFn("better-sqlite3");
    const Ctor: new (path: string) => Database =
      betterSqlite.default ?? betterSqlite;
    return { kind: "better", client: new Ctor(env.databaseUrl) };
  } catch (error) {
    try {
      const bunSqlite = requireFn("bun:sqlite");
      // For bun, we can use the path directly with drizzle
      return { kind: "bun", path: env.databaseUrl };
    } catch {
      throw new Error("No SQLite implementation available");
    }
  }
}
