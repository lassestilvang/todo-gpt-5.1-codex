import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    timezone: text("timezone").default("UTC"),
    settings: text("settings", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    themePreference: text("theme_preference"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  })
);

export const lists = sqliteTable(
  "lists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji"),
    color: text("color").default("#6366f1"),
    sortOrder: integer("sort_order").default(0),
    isSystem: integer("is_system", { mode: "boolean" }).default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userNameIdx: uniqueIndex("lists_user_name_idx").on(
      table.userId,
      table.name
    ),
    sortIdx: index("lists_sort_idx").on(table.userId, table.sortOrder),
  })
);

export const labels = sqliteTable(
  "labels",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji"),
    color: text("color").default("#10b981"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userNameIdx: uniqueIndex("labels_user_name_idx").on(
      table.userId,
      table.name
    ),
  })
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    scheduledDate: integer("scheduled_date", { mode: "timestamp" }),
    deadline: integer("deadline", { mode: "timestamp" }),
    priority: text("priority").default("none"),
    status: text("status").default("pending"),
    estimateMinutes: integer("estimate_minutes"),
    actualMinutes: integer("actual_minutes"),
    recurrenceRuleId: text("recurrence_rule_id"),
    attachmentCount: integer("attachment_count").default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => ({
    userStatusIdx: index("tasks_user_status_idx").on(
      table.userId,
      table.status
    ),
    scheduleIdx: index("tasks_schedule_idx").on(
      table.userId,
      table.scheduledDate
    ),
  })
);

export const taskLabels = sqliteTable(
  "task_labels",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.taskId, table.labelId],
      name: "task_labels_pk",
    }),
  })
);

export const subtasks = sqliteTable("subtasks", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isDone: integer("is_done", { mode: "boolean" }).default(false),
  orderIndex: integer("order_index").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  remindAt: integer("remind_at", { mode: "timestamp" }).notNull(),
  channel: text("channel").default("in_app"),
  status: text("status").default("scheduled"),
  snoozeCount: integer("snooze_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const recurrenceRules = sqliteTable("recurrence_rules", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  rruleText: text("rrule_text").notNull(),
  timezone: text("timezone").default("UTC"),
  nextOccurrence: integer("next_occurrence", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const timeEntries = sqliteTable("time_entries", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  minutes: integer("minutes").notNull(),
  source: text("source"),
  recordedAt: integer("recorded_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const availabilityBlocks = sqliteTable("availability_blocks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startAt: integer("start_at", { mode: "timestamp" }).notNull(),
  endAt: integer("end_at", { mode: "timestamp" }).notNull(),
  type: text("type").default("free"),
  note: text("note"),
});

export const taskChangeLog = sqliteTable(
  "task_change_log",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    taskId: text("task_id"),
    changedBy: text("changed_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    field: text("field").notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    changedAt: integer("changed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    entityIdx: index("task_change_log_entity_idx").on(
      table.entityType,
      table.entityId,
      table.changedAt
    ),
    taskIdx: index("task_change_log_task_idx").on(
      table.taskId,
      table.changedAt
    ),
  })
);

export const AUDIT_ENTITY_TYPES = [
  "task",
  "subtask",
  "reminder",
  "label",
  "list",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = ["insert", "update", "delete"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_FIELD = "__entity__" as const;

export type AuditEntityDescriptor = {
  field: string;
  resolveTaskId?: (
    record?: Record<string, unknown> | null
  ) => string | null | undefined;
};

export const AUDIT_ENTITY_CONFIG: Record<
  AuditEntityType,
  AuditEntityDescriptor
> = {
  task: {
    field: AUDIT_ENTITY_FIELD,
    resolveTaskId: (record) => (record?.id as string) ?? null,
  },
  subtask: {
    field: "subtask",
    resolveTaskId: (record) => (record?.taskId as string) ?? null,
  },
  reminder: {
    field: "reminder",
    resolveTaskId: (record) => (record?.taskId as string) ?? null,
  },
  label: {
    field: "label",
  },
  list: {
    field: "list",
  },
} as const;

export function resolveAuditTaskId(
  entityType: AuditEntityType,
  record?: Record<string, unknown> | null,
  fallbackTaskId?: string | null
) {
  const descriptor = AUDIT_ENTITY_CONFIG[entityType];
  const taskId = descriptor?.resolveTaskId?.(record);
  return taskId ?? fallbackTaskId ?? null;
}

export const ftsTasks = sqliteTable("fts_tasks", {
  rowid: integer("rowid").primaryKey({ autoIncrement: true }),
  taskId: text("task_id"),
  userId: text("user_id"),
  listId: text("list_id"),
  title: text("title"),
  description: text("description"),
  listName: text("list_name"),
  listColor: text("list_color"),
  labels: text("labels"),
  priority: text("priority"),
});

export const syncStates = sqliteTable("sync_states", {
  id: text("id").primaryKey(),
  entity: text("entity").notNull(),
  checkpoint: integer("checkpoint", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
