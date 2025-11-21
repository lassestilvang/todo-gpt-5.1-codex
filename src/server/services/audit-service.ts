import { and, eq, sql, type SQL } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_CONFIG,
  AUDIT_ENTITY_FIELD,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
  db,
  resolveAuditTaskId,
  taskChangeLog,
} from "@/server/db";
import * as schema from "@/server/db/schema";

type AuditDbClient = typeof db | BetterSQLite3Database<typeof schema>;

type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | JsonSerializable[]
  | { [key: string]: JsonSerializable };
export type AuditValue =
  | JsonSerializable
  | Record<string, unknown>
  | Array<unknown>
  | undefined;

export type { AuditAction, AuditEntityType } from "@/server/db";

export type AuditRecordDTO = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  taskId: string | null;
  changedBy: string;
  action: AuditAction;
  field: string;
  previousValue: AuditValue;
  newValue: AuditValue;
  changedAt: Date;
};

type BaseChangeInput = {
  entityType: AuditEntityType;
  entityId: string;
  taskId?: string | null;
  userId: string;
  action: AuditAction;
};

export type RecordChangeInput = BaseChangeInput & {
  field?: string;
  previousValue?: AuditValue;
  newValue?: AuditValue;
  skipRedundant?: boolean;
};

export type FieldChange = {
  field: string;
  previousValue?: AuditValue;
  newValue?: AuditValue;
};

export type RecordBulkChangeInput = BaseChangeInput & {
  changes: FieldChange[];
  skipRedundant?: boolean;
};

export type HistoryFilters = {
  entityType?: AuditEntityType;
  entityId?: string;
  taskId?: string;
  limit?: number;
  offset?: number;
};

function serialize(value: AuditValue): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseJson(value: string | null): AuditValue {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class AuditService {
  private static instance: AuditService;

  static getInstance() {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  static withDb(client: AuditDbClient) {
    return new AuditService(client);
  }

  private constructor(private readonly client: AuditDbClient = db) {}

  async recordChange(input: RecordChangeInput) {
    this.validateInput(input.entityType, input.action);

    const descriptor = AUDIT_ENTITY_CONFIG[input.entityType];
    const field = input.field ?? descriptor.field ?? AUDIT_ENTITY_FIELD;

    const hasBoth =
      input.previousValue !== undefined && input.newValue !== undefined;
    if (
      input.skipRedundant !== false &&
      hasBoth &&
      AuditService.valuesEqual(input.previousValue, input.newValue)
    ) {
      return;
    }

    const contextRecord = (input.newValue ?? input.previousValue) as
      | Record<string, unknown>
      | undefined;

    await this.client.insert(taskChangeLog).values({
      id: crypto.randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      taskId:
        resolveAuditTaskId(input.entityType, contextRecord, input.taskId) ??
        null,
      changedBy: input.userId,
      action: input.action,
      field,
      previousValue: serialize(input.previousValue),
      newValue: serialize(input.newValue),
    });
  }

  async recordBulkChanges(input: RecordBulkChangeInput) {
    this.validateInput(input.entityType, input.action);

    const descriptor = AUDIT_ENTITY_CONFIG[input.entityType];
    const rows = input.changes
      .map((change) => ({
        field: change.field ?? descriptor.field ?? AUDIT_ENTITY_FIELD,
        previousValue: change.previousValue,
        newValue: change.newValue,
      }))
      .filter((change) => {
        const hasBoth =
          change.previousValue !== undefined && change.newValue !== undefined;
        if (hasBoth && input.skipRedundant !== false) {
          return !AuditService.valuesEqual(
            change.previousValue,
            change.newValue
          );
        }
        return true;
      })
      .map((change) => {
        const contextRecord = (change.newValue ?? change.previousValue) as
          | Record<string, unknown>
          | undefined;
        return {
          id: crypto.randomUUID(),
          entityType: input.entityType,
          entityId: input.entityId,
          taskId:
            resolveAuditTaskId(input.entityType, contextRecord, input.taskId) ??
            null,
          changedBy: input.userId,
          action: input.action,
          field: change.field,
          previousValue: serialize(change.previousValue),
          newValue: serialize(change.newValue),
        };
      });

    if (!rows.length) return;

    await this.client.insert(taskChangeLog).values(rows);
  }

  async getTaskHistory(
    taskId: string,
    filters: Omit<HistoryFilters, "taskId"> = {}
  ) {
    return this.listChanges({ ...filters, taskId });
  }

  async getEntityHistory(
    entityType: AuditEntityType,
    entityId: string,
    filters: Omit<HistoryFilters, "entityType" | "entityId"> = {}
  ) {
    return this.listChanges({ ...filters, entityType, entityId });
  }

  async listChanges(input: HistoryFilters = {}): Promise<AuditRecordDTO[]> {
    const { entityType, entityId, taskId, limit = 50, offset = 0 } = input;

    const filters: SQL<unknown>[] = [];
    if (entityType) {
      filters.push(eq(taskChangeLog.entityType, entityType));
    }
    if (entityId) {
      filters.push(eq(taskChangeLog.entityId, entityId));
    }
    if (taskId) {
      filters.push(eq(taskChangeLog.taskId, taskId));
    }

    let whereClause: SQL<unknown> | undefined;
    for (const filter of filters) {
      whereClause = whereClause ? and(whereClause, filter) : filter;
    }

    const baseQuery = this.client
      .select()
      .from(taskChangeLog)
      .orderBy(sql`${taskChangeLog.changedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const query = whereClause ? baseQuery.where(whereClause) : baseQuery;
    const rows = await query;

    return rows.map((row) => this.mapRow(row));
  }

  static deriveFieldChanges(
    previous?: Record<string, unknown> | null,
    next?: Record<string, unknown> | null,
    fields?: readonly (string | number | symbol)[]
  ): FieldChange[] {
    const prevRecord = previous ?? {};
    const nextRecord = next ?? {};
    const keys = fields
      ? Array.from(new Set(fields.map((key) => key.toString())))
      : Array.from(
          new Set([...Object.keys(prevRecord), ...Object.keys(nextRecord)])
        );

    const changes: FieldChange[] = [];
    for (const key of keys) {
      const prevValue = (prevRecord as Record<string, unknown>)[key];
      const nextValue = (nextRecord as Record<string, unknown>)[key];
      if (
        AuditService.valuesEqual(
          prevValue as AuditValue,
          nextValue as AuditValue
        )
      ) {
        continue;
      }
      changes.push({
        field: key,
        previousValue: prevValue as AuditValue,
        newValue: nextValue as AuditValue,
      });
    }
    return changes;
  }

  private validateInput(entityType: AuditEntityType, action: AuditAction) {
    if (!AUDIT_ENTITY_TYPES.includes(entityType)) {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }
    if (!AUDIT_ACTIONS.includes(action)) {
      throw new Error(`Unsupported audit action: ${action}`);
    }
  }

  private static valuesEqual(
    previousValue?: AuditValue,
    newValue?: AuditValue
  ) {
    return JSON.stringify(previousValue) === JSON.stringify(newValue);
  }

  private mapRow(row: typeof taskChangeLog.$inferSelect): AuditRecordDTO {
    return {
      id: row.id,
      entityType: row.entityType as AuditEntityType,
      entityId: row.entityId,
      taskId: row.taskId ?? null,
      changedBy: row.changedBy,
      action: row.action as AuditAction,
      field: row.field,
      previousValue: parseJson(row.previousValue ?? null),
      newValue: parseJson(row.newValue ?? null),
      changedAt: row.changedAt,
    };
  }
}

export type EntityAuditLoggerInput = Omit<RecordChangeInput, "entityType">;

export function createAuditLogger(
  entityType: AuditEntityType,
  client?: AuditDbClient
) {
  const service = client
    ? AuditService.withDb(client)
    : AuditService.getInstance();
  return (input: EntityAuditLoggerInput) =>
    service.recordChange({ ...input, entityType });
}
