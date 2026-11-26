import { randomUUID } from "node:crypto";
import type {
  FlowEdge,
  FlowNode,
  FlowNodeType,
  NodeExecutionLogRecord,
  NodeExecutionStatus,
  WorkflowCreateInput,
  WorkflowRecord,
  WorkflowRunRecord,
  WorkflowUpdateInput,
} from "@/contracts/workflow";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { nodeExecutionLogs, workflowRuns, workflows } from "./schema";

function mapWorkflowRow(row: typeof workflows.$inferSelect): WorkflowRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    nodes: JSON.parse(row.nodesJson) as FlowNode[],
    edges: JSON.parse(row.edgesJson) as FlowEdge[],
    isDemo: Boolean(row.isDemo),
    updatedAt: row.updatedAt,
  };
}

function mapNodeLogRow(
  row: typeof nodeExecutionLogs.$inferSelect,
): NodeExecutionLogRecord {
  return {
    nodeId: row.nodeId,
    nodeType: row.nodeType as FlowNodeType,
    status: row.status as NodeExecutionStatus,
    inputJson: JSON.parse(row.inputJson) as Record<string, unknown>,
    outputJson: JSON.parse(row.outputJson) as Record<string, unknown>,
    errorMessage: row.errorMessage ?? null,
    durationMs: row.durationMs,
    executedAt: row.executedAt,
  };
}

export async function listWorkflows(): Promise<WorkflowRecord[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(workflows)
    .orderBy(desc(workflows.isDemo), desc(workflows.updatedAt));
  return rows.map(mapWorkflowRow);
}

export async function getWorkflowById(
  id: string,
): Promise<WorkflowRecord | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .limit(1);
  return row ? mapWorkflowRow(row) : null;
}

export async function createWorkflow(
  input: WorkflowCreateInput,
): Promise<WorkflowRecord> {
  const db = await getDb();
  const id = `wf-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  await db.insert(workflows).values({
    id,
    name: input.name,
    description: input.description,
    nodesJson: JSON.stringify(input.nodes),
    edgesJson: JSON.stringify(input.edges),
    isDemo: false,
    updatedAt: now,
  });
  return {
    id,
    name: input.name,
    description: input.description,
    nodes: input.nodes,
    edges: input.edges,
    isDemo: false,
    updatedAt: now,
  };
}

export async function updateWorkflow(
  id: string,
  patch: WorkflowUpdateInput,
): Promise<WorkflowRecord | null> {
  const existing = await getWorkflowById(id);
  if (!existing) return null;

  const db = await getDb();
  const updated: WorkflowRecord = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    nodes: patch.nodes ?? existing.nodes,
    edges: patch.edges ?? existing.edges,
    updatedAt: new Date().toISOString(),
  };

  await db
    .update(workflows)
    .set({
      name: updated.name,
      description: updated.description,
      nodesJson: JSON.stringify(updated.nodes),
      edgesJson: JSON.stringify(updated.edges),
      updatedAt: updated.updatedAt,
    })
    .where(eq(workflows.id, id));

  return updated;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const existing = await getWorkflowById(id);
  if (!existing) return false;
  const db = await getDb();
  await db.delete(workflows).where(eq(workflows.id, id));
  return true;
}

export async function saveWorkflowRun(params: {
  workflowId: string;
  status: "success" | "failed";
  triggerPayload: Record<string, unknown>;
  totalDurationMs: number;
  startedAt: string;
  finishedAt: string;
  nodeLogs: NodeExecutionLogRecord[];
}): Promise<WorkflowRunRecord> {
  const db = await getDb();
  const runId = `run-${randomUUID().slice(0, 10)}`;

  await db.insert(workflowRuns).values({
    id: runId,
    workflowId: params.workflowId,
    status: params.status,
    triggerPayload: JSON.stringify(params.triggerPayload),
    totalDurationMs: params.totalDurationMs,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
  });

  for (const log of params.nodeLogs) {
    await db.insert(nodeExecutionLogs).values({
      id: `nlog-${randomUUID().slice(0, 10)}`,
      runId,
      nodeId: log.nodeId,
      nodeType: log.nodeType,
      status: log.status,
      inputJson: JSON.stringify(log.inputJson),
      outputJson: JSON.stringify(log.outputJson),
      errorMessage: log.errorMessage,
      durationMs: log.durationMs,
      executedAt: log.executedAt,
    });
  }

  return {
    id: runId,
    workflowId: params.workflowId,
    status: params.status,
    triggerPayload: params.triggerPayload,
    totalDurationMs: params.totalDurationMs,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    nodeLogs: params.nodeLogs,
  };
}

export async function getWorkflowRunById(
  runId: string,
): Promise<WorkflowRunRecord | null> {
  const db = await getDb();
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId))
    .limit(1);
  if (!run) return null;

  const logs = await db
    .select()
    .from(nodeExecutionLogs)
    .where(eq(nodeExecutionLogs.runId, run.id));

  return {
    id: run.id,
    workflowId: run.workflowId,
    status: run.status as "success" | "failed",
    triggerPayload: JSON.parse(run.triggerPayload) as Record<string, unknown>,
    totalDurationMs: run.totalDurationMs,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    nodeLogs: logs.map(mapNodeLogRow),
  };
}

export async function listWorkflowRuns(
  workflowId: string,
  limit = 10,
): Promise<WorkflowRunRecord[]> {
  const db = await getDb();
  const runs = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowId, workflowId))
    .orderBy(desc(workflowRuns.startedAt))
    .limit(limit);

  const result: WorkflowRunRecord[] = [];
  for (const run of runs) {
    const logs = await db
      .select()
      .from(nodeExecutionLogs)
      .where(eq(nodeExecutionLogs.runId, run.id));
    result.push({
      id: run.id,
      workflowId: run.workflowId,
      status: run.status as "success" | "failed",
      triggerPayload: JSON.parse(run.triggerPayload) as Record<string, unknown>,
      totalDurationMs: run.totalDurationMs,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      nodeLogs: logs.map(mapNodeLogRow),
    });
  }
  return result;
}
