import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  nodesJson: text("nodes_json").notNull(),
  edgesJson: text("edges_json").notNull(),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

export const workflowRuns = sqliteTable("workflow_runs", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  triggerPayload: text("trigger_payload").notNull(),
  totalDurationMs: integer("total_duration_ms").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at").notNull(),
});

export const nodeExecutionLogs = sqliteTable("node_execution_logs", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => workflowRuns.id, { onDelete: "cascade" }),
  nodeId: text("node_id").notNull(),
  nodeType: text("node_type").notNull(),
  status: text("status").notNull(),
  inputJson: text("input_json").notNull(),
  outputJson: text("output_json").notNull(),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms").notNull(),
  executedAt: text("executed_at").notNull(),
});
