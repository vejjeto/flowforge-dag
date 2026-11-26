import type {
  FlowEdge,
  FlowNode,
  NodeExecutionLogRecord,
  WorkflowExecutionResult,
} from "@/contracts/workflow";
import { dispatchNodeExecution } from "@/core/nodes";
import { computeTopologicalLevels, validateDag } from "./dag";

export type ExecutionStreamEvent =
  | { type: "node:start"; nodeId: string; nodeType: string }
  | { type: "node:complete"; log: NodeExecutionLogRecord };

export interface ExecuteWorkflowOptions {
  nodes: FlowNode[];
  edges: FlowEdge[];
  triggerPayload?: Record<string, unknown>;
  onEvent?: (event: ExecutionStreamEvent) => void;
}

export interface ReplayFromNodeOptions {
  nodes: FlowNode[];
  edges: FlowEdge[];
  targetNodeId: string;
  previousLogs: NodeExecutionLogRecord[];
  triggerPayload?: Record<string, unknown>;
  onEvent?: (event: ExecutionStreamEvent) => void;
}

function resolveNodeInput(
  node: FlowNode,
  incoming: FlowEdge[],
  activatedEdges: Set<string>,
  nodeOutputs: Map<string, Record<string, unknown>>,
  triggerPayload: Record<string, unknown>,
): Record<string, unknown> {
  if (incoming.length === 0) {
    return node.data.nodeType === "trigger"
      ? triggerPayload
      : { ...triggerPayload };
  }
  const activeSources = incoming.filter((e) => activatedEdges.has(e.id));
  const firstSource = activeSources[0];
  if (activeSources.length === 1 && firstSource) {
    return { ...(nodeOutputs.get(firstSource.source) ?? {}) };
  }
  const merged: Record<string, unknown> = {};
  for (const edge of activeSources) {
    Object.assign(merged, nodeOutputs.get(edge.source) ?? {});
  }
  return merged;
}

function activateOutgoingEdges(
  node: FlowNode,
  outgoing: FlowEdge[],
  matchedBranch: "true" | "false" | undefined,
  activatedEdges: Set<string>,
): void {
  for (const edge of outgoing) {
    if (node.data.nodeType === "condition") {
      const handle = edge.sourceHandle ?? "true";
      if (handle === matchedBranch) {
        activatedEdges.add(edge.id);
      }
    } else {
      activatedEdges.add(edge.id);
    }
  }
}

function buildEdgeMaps(edges: FlowEdge[]): {
  incomingMap: Map<string, FlowEdge[]>;
  outgoingMap: Map<string, FlowEdge[]>;
} {
  const incomingMap = new Map<string, FlowEdge[]>();
  const outgoingMap = new Map<string, FlowEdge[]>();
  for (const edge of edges) {
    const inc = incomingMap.get(edge.target) ?? [];
    inc.push(edge);
    incomingMap.set(edge.target, inc);

    const out = outgoingMap.get(edge.source) ?? [];
    out.push(edge);
    outgoingMap.set(edge.source, out);
  }
  return { incomingMap, outgoingMap };
}

function buildInvalidDagResult(
  nodes: FlowNode[],
  validation: ReturnType<typeof validateDag>,
  startAll: number,
): WorkflowExecutionResult {
  const cycleSet = new Set(validation.cycleNodes);
  const now = new Date().toISOString();
  const cycleLogs: NodeExecutionLogRecord[] = nodes.map((node) => ({
    nodeId: node.id,
    nodeType: node.data.nodeType,
    status: cycleSet.has(node.id) ? "failed" : "skipped",
    inputJson: {},
    outputJson: {},
    errorMessage: cycleSet.has(node.id)
      ? "Ciclo detectado en el grafo DAG"
      : null,
    durationMs: 0,
    executedAt: now,
  }));
  return {
    status: "failed",
    totalDurationMs: Math.round(performance.now() - startAll),
    validation,
    nodeLogs: cycleLogs,
  };
}

async function executeLevelNodes(params: {
  levelIds: string[];
  nodeMap: Map<string, FlowNode>;
  incomingMap: Map<string, FlowEdge[]>;
  outgoingMap: Map<string, FlowEdge[]>;
  activatedEdges: Set<string>;
  nodeOutputs: Map<string, Record<string, unknown>>;
  triggerPayload: Record<string, unknown>;
  onEvent?: (event: ExecutionStreamEvent) => void;
}): Promise<{ logs: NodeExecutionLogRecord[]; hasFailure: boolean }> {
  const {
    levelIds,
    nodeMap,
    incomingMap,
    outgoingMap,
    activatedEdges,
    nodeOutputs,
    triggerPayload,
    onEvent,
  } = params;

  const logs: NodeExecutionLogRecord[] = [];
  let hasFailure = false;

  const runnableNodes: Array<{
    node: FlowNode;
    input: Record<string, unknown>;
  }> = [];

  for (const nodeId of levelIds) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const incoming = incomingMap.get(nodeId) ?? [];
    const hasActiveIncoming = incoming.some((e) => activatedEdges.has(e.id));

    if (incoming.length > 0 && !hasActiveIncoming) {
      const skippedLog: NodeExecutionLogRecord = {
        nodeId: node.id,
        nodeType: node.data.nodeType,
        status: "skipped",
        inputJson: {},
        outputJson: {},
        errorMessage: null,
        durationMs: 0,
        executedAt: new Date().toISOString(),
      };
      logs.push(skippedLog);
      onEvent?.({ type: "node:complete", log: skippedLog });
      continue;
    }

    const nodeInput = resolveNodeInput(
      node,
      incoming,
      activatedEdges,
      nodeOutputs,
      triggerPayload,
    );
    onEvent?.({
      type: "node:start",
      nodeId: node.id,
      nodeType: node.data.nodeType,
    });
    runnableNodes.push({ node, input: nodeInput });
  }

  const settled = await Promise.allSettled(
    runnableNodes.map(async ({ node, input }) => {
      const nodeStart = performance.now();
      const result = await dispatchNodeExecution(node, input);
      return {
        node,
        input,
        result,
        durationMs: Math.max(1, Math.round(performance.now() - nodeStart)),
      };
    }),
  );

  settled.forEach((outcome, idx) => {
    const entry = runnableNodes[idx];
    if (!entry) return;
    if (outcome.status === "fulfilled") {
      const { node, input, result, durationMs } = outcome.value;
      nodeOutputs.set(node.id, result.output);
      activateOutgoingEdges(
        node,
        outgoingMap.get(node.id) ?? [],
        result.matchedBranch,
        activatedEdges,
      );
      const log: NodeExecutionLogRecord = {
        nodeId: node.id,
        nodeType: node.data.nodeType,
        status: "success",
        inputJson: input,
        outputJson: result.output,
        errorMessage: null,
        durationMs,
        executedAt: new Date().toISOString(),
      };
      logs.push(log);
      onEvent?.({ type: "node:complete", log });
    } else {
      hasFailure = true;
      const err = outcome.reason;
      const log: NodeExecutionLogRecord = {
        nodeId: entry.node.id,
        nodeType: entry.node.data.nodeType,
        status: "failed",
        inputJson: entry.input,
        outputJson: {},
        errorMessage:
          err instanceof Error ? err.message : "Node execution failed",
        durationMs: 1,
        executedAt: new Date().toISOString(),
      };
      logs.push(log);
      onEvent?.({ type: "node:complete", log });
    }
  });

  return { logs, hasFailure };
}

/**
 * Executes a workflow DAG in parallel Kahn topological levels using Promise.allSettled,
 * propagating conditional branches and recording per-node checkpoints.
 */
export async function executeWorkflowGraph(
  options: ExecuteWorkflowOptions,
): Promise<WorkflowExecutionResult> {
  const startAll = performance.now();
  const validation = validateDag(options.nodes, options.edges);

  if (!validation.valid) {
    return buildInvalidDagResult(options.nodes, validation, startAll);
  }

  const levels = computeTopologicalLevels(options.nodes, options.edges);
  const nodeMap = new Map(options.nodes.map((n) => [n.id, n]));
  const { incomingMap, outgoingMap } = buildEdgeMaps(options.edges);
  const activatedEdges = new Set<string>();
  const nodeOutputs = new Map<string, Record<string, unknown>>();
  const nodeLogs: NodeExecutionLogRecord[] = [];
  const triggerPayload = options.triggerPayload ?? {};
  let hasFailure = false;

  for (const levelIds of levels) {
    const levelResult = await executeLevelNodes({
      levelIds,
      nodeMap,
      incomingMap,
      outgoingMap,
      activatedEdges,
      nodeOutputs,
      triggerPayload,
      ...(options.onEvent ? { onEvent: options.onEvent } : {}),
    });
    nodeLogs.push(...levelResult.logs);
    if (levelResult.hasFailure) hasFailure = true;
  }

  return {
    status: hasFailure ? "failed" : "success",
    totalDurationMs: Math.max(1, Math.round(performance.now() - startAll)),
    validation,
    nodeLogs,
  };
}

function collectDownstreamNodes(
  startNodeId: string,
  outgoingMap: Map<string, FlowEdge[]>,
): Set<string> {
  const downstream = new Set<string>([startNodeId]);
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of outgoingMap.get(current) ?? []) {
      if (!downstream.has(edge.target)) {
        downstream.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return downstream;
}

/**
 * Replays a workflow execution from a target/failed node onward, reusing persisted
 * outputJson checkpoints from upstream successful nodes without re-executing them.
 */
export async function replayFromNode(
  options: ReplayFromNodeOptions,
): Promise<WorkflowExecutionResult> {
  const startAll = performance.now();
  const validation = validateDag(options.nodes, options.edges);

  if (!validation.valid) {
    return buildInvalidDagResult(options.nodes, validation, startAll);
  }

  const nodeMap = new Map(options.nodes.map((n) => [n.id, n]));
  if (!nodeMap.has(options.targetNodeId)) {
    throw new Error(
      `Target node "${options.targetNodeId}" not found in workflow`,
    );
  }

  const levels = computeTopologicalLevels(options.nodes, options.edges);
  const { incomingMap, outgoingMap } = buildEdgeMaps(options.edges);
  const reexecuteSet = collectDownstreamNodes(
    options.targetNodeId,
    outgoingMap,
  );
  const prevLogMap = new Map(options.previousLogs.map((l) => [l.nodeId, l]));

  const activatedEdges = new Set<string>();
  const nodeOutputs = new Map<string, Record<string, unknown>>();
  const nodeLogs: NodeExecutionLogRecord[] = [];
  const triggerPayload = options.triggerPayload ?? {};
  let hasFailure = false;

  for (const levelIds of levels) {
    const toRun: string[] = [];

    for (const nodeId of levelIds) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      if (!reexecuteSet.has(nodeId)) {
        const prev = prevLogMap.get(nodeId);
        if (prev && prev.status === "success") {
          nodeOutputs.set(nodeId, prev.outputJson);
          const condMeta = prev.outputJson._condition as
            | { branch?: "true" | "false" }
            | undefined;
          activateOutgoingEdges(
            node,
            outgoingMap.get(nodeId) ?? [],
            condMeta?.branch,
            activatedEdges,
          );
          nodeLogs.push(prev);
        } else if (prev) {
          if (prev.status === "failed") hasFailure = true;
          nodeLogs.push(prev);
        }
      } else {
        toRun.push(nodeId);
      }
    }

    if (toRun.length > 0) {
      const levelResult = await executeLevelNodes({
        levelIds: toRun,
        nodeMap,
        incomingMap,
        outgoingMap,
        activatedEdges,
        nodeOutputs,
        triggerPayload,
        ...(options.onEvent ? { onEvent: options.onEvent } : {}),
      });
      nodeLogs.push(...levelResult.logs);
      if (levelResult.hasFailure) hasFailure = true;
    }
  }

  return {
    status: hasFailure ? "failed" : "success",
    totalDurationMs: Math.max(1, Math.round(performance.now() - startAll)),
    validation,
    nodeLogs,
  };
}
