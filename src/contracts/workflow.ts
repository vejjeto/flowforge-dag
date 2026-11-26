import { z } from "zod";

export const NodeTypeSchema = z.enum([
  "trigger",
  "condition",
  "transform",
  "http",
  "ai_summary",
  "log_notify",
]);
export type FlowNodeType = z.infer<typeof NodeTypeSchema>;

export const NodeStatusSchema = z.enum([
  "idle",
  "running",
  "success",
  "failed",
  "skipped",
]);
export type NodeExecutionStatus = z.infer<typeof NodeStatusSchema>;

export const ConditionOperatorSchema = z.enum([
  "==",
  "!=",
  ">",
  "<",
  "contains",
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const TriggerNodeDataSchema = z.object({
  nodeType: z.literal("trigger"),
  label: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const ConditionNodeDataSchema = z.object({
  nodeType: z.literal("condition"),
  label: z.string().min(1),
  fieldPath: z.string().min(1),
  operator: ConditionOperatorSchema,
  value: z.string(),
});

export const TransformNodeDataSchema = z.object({
  nodeType: z.literal("transform"),
  label: z.string().min(1),
  template: z.record(z.string(), z.unknown()),
});

export const HttpRequestNodeDataSchema = z.object({
  nodeType: z.literal("http"),
  label: z.string().min(1),
  method: z.enum(["GET", "POST"]),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
});

export const AiSummaryNodeDataSchema = z.object({
  nodeType: z.literal("ai_summary"),
  label: z.string().min(1),
  prompt: z.string().min(1),
});

export const LogNotifyNodeDataSchema = z.object({
  nodeType: z.literal("log_notify"),
  label: z.string().min(1),
  channel: z.string().min(1),
  messageTemplate: z.string().min(1),
});

export const FlowNodeDataSchema = z.discriminatedUnion("nodeType", [
  TriggerNodeDataSchema,
  ConditionNodeDataSchema,
  TransformNodeDataSchema,
  HttpRequestNodeDataSchema,
  AiSummaryNodeDataSchema,
  LogNotifyNodeDataSchema,
]);
export type FlowNodeData = z.infer<typeof FlowNodeDataSchema>;

export const FlowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().default("flowNode"),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: FlowNodeDataSchema,
});
export type FlowNode = z.infer<typeof FlowNodeSchema>;

export const FlowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().optional(),
});
export type FlowEdge = z.infer<typeof FlowEdgeSchema>;

export const WorkflowCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  nodes: z.array(FlowNodeSchema).min(1),
  edges: z.array(FlowEdgeSchema).default([]),
});
export type WorkflowCreateInput = z.infer<typeof WorkflowCreateSchema>;

export const WorkflowUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  nodes: z.array(FlowNodeSchema).min(1).optional(),
  edges: z.array(FlowEdgeSchema).optional(),
});
export type WorkflowUpdateInput = z.infer<typeof WorkflowUpdateSchema>;

export const ValidateDagRequestSchema = z.object({
  nodes: z.array(FlowNodeSchema).optional(),
  edges: z.array(FlowEdgeSchema).optional(),
});

export const ExecuteWorkflowRequestSchema = z.object({
  triggerPayload: z.record(z.string(), z.unknown()).optional(),
  nodes: z.array(FlowNodeSchema).optional(),
  edges: z.array(FlowEdgeSchema).optional(),
});

export interface DagValidationResult {
  valid: boolean;
  executionOrder: string[];
  cycleNodes: string[];
  cycleEdges: string[];
}

export interface NodeExecutionLogRecord {
  nodeId: string;
  nodeType: FlowNodeType;
  status: NodeExecutionStatus;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  errorMessage: string | null;
  durationMs: number;
  executedAt: string;
}

export interface WorkflowExecutionResult {
  status: "success" | "failed";
  totalDurationMs: number;
  validation: DagValidationResult;
  nodeLogs: NodeExecutionLogRecord[];
}

export interface WorkflowRecord {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  isDemo: boolean;
  updatedAt: string;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  status: "success" | "failed";
  triggerPayload: Record<string, unknown>;
  totalDurationMs: number;
  startedAt: string;
  finishedAt: string;
  nodeLogs?: NodeExecutionLogRecord[];
}
