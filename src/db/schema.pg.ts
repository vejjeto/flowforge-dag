import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

export const workflowsPg = pgTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  nodesJson: text("nodes_json").notNull(),
  edgesJson: text("edges_json").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

export const workflowRunsPg = pgTable("workflow_runs", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflowsPg.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  triggerPayload: text("trigger_payload").notNull(),
  totalDurationMs: integer("total_duration_ms").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at").notNull(),
});

export const nodeExecutionLogsPg = pgTable("node_execution_logs", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => workflowRunsPg.id, { onDelete: "cascade" }),
  nodeId: text("node_id").notNull(),
  nodeType: text("node_type").notNull(),
  status: text("status").notNull(),
  inputJson: text("input_json").notNull(),
  outputJson: text("output_json").notNull(),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms").notNull(),
  executedAt: text("executed_at").notNull(),
});
