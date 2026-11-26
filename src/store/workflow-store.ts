import { NODE_TYPE_META } from "@/components/studio/node-meta";
import type {
  DagValidationResult,
  FlowEdge,
  FlowNode,
  FlowNodeData,
  FlowNodeType,
  NodeExecutionLogRecord,
  NodeExecutionStatus,
  WorkflowRecord,
} from "@/contracts/workflow";
import { validateDag } from "@/core/graph/dag";
import {
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import { create } from "zustand";

export type RfNode = Node<FlowNodeData, "flowNode">;
export type RfEdge = Edge;

interface GraphSnapshot {
  nodes: RfNode[];
  edges: RfEdge[];
}

interface WorkflowStudioState {
  workflowId: string;
  workflowName: string;
  workflowDescription: string;
  nodes: RfNode[];
  edges: RfEdge[];
  selectedNodeId: string | null;
  validation: DagValidationResult;
  nodeStatuses: Record<string, NodeExecutionStatus>;
  nodeLogs: Record<string, NodeExecutionLogRecord>;
  isExecuting: boolean;
  lastRunId: string | null;
  lastRunDurationMs: number | null;
  historyPast: GraphSnapshot[];
  historyFuture: GraphSnapshot[];

  loadWorkflow: (wf: WorkflowRecord) => void;
  setWorkflowMeta: (name: string, description: string) => void;
  onNodesChange: (changes: NodeChange<RfNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<RfEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  selectNode: (nodeId: string | null) => void;
  addNode: (
    nodeType: FlowNodeType,
    position?: { x: number; y: number },
  ) => void;
  updateNodeData: (
    nodeId: string,
    updater: (prev: FlowNodeData) => FlowNodeData,
  ) => void;
  deleteNode: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
  autoLayout: () => void;
  simulateCycle: () => void;
  clearCycleEdges: () => void;
  setIsExecuting: (executing: boolean) => void;
  resetExecutionState: () => void;
  markNodeRunning: (nodeId: string) => void;
  applyNodeLog: (log: NodeExecutionLogRecord) => void;
  setLastRunId: (id: string | null) => void;
  setLastRunDurationMs: (ms: number | null) => void;
  applyReplayLogs: (
    logs: NodeExecutionLogRecord[],
    durationMs: number,
    runId: string,
  ) => void;
}

function toRfNodes(nodes: FlowNode[]): RfNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "flowNode",
    position: n.position,
    data: n.data,
  }));
}

function toRfEdges(edges: FlowEdge[]): RfEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    ...(e.label !== undefined ? { label: e.label } : {}),
  }));
}

export function toContractGraph(
  nodes: RfNode[],
  edges: RfEdge[],
): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: "flowNode",
      position: n.position,
      data: n.data,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      ...(typeof e.label === "string" ? { label: e.label } : {}),
    })),
  };
}

function computeValidation(
  nodes: RfNode[],
  edges: RfEdge[],
): DagValidationResult {
  const contract = toContractGraph(nodes, edges);
  return validateDag(contract.nodes, contract.edges);
}

function pushSnapshot(state: WorkflowStudioState): GraphSnapshot[] {
  return [
    ...state.historyPast.slice(-24),
    { nodes: state.nodes, edges: state.edges },
  ];
}

function computeAutoLayoutPositions(
  nodes: RfNode[],
  edges: RfEdge[],
): RfNode[] {
  const validation = computeValidation(nodes, edges);
  const order = validation.valid
    ? validation.executionOrder
    : nodes.map((n) => n.id);
  const depth = new Map<string, number>();

  for (const id of order) {
    const parents = edges
      .filter((e) => e.target === id)
      .map((e) => depth.get(e.source) ?? 0);
    depth.set(id, parents.length > 0 ? Math.max(...parents) + 1 : 0);
  }

  const buckets = new Map<number, string[]>();
  for (const id of order) {
    const col = depth.get(id) ?? 0;
    const list = buckets.get(col) ?? [];
    list.push(id);
    buckets.set(col, list);
  }

  const posMap = new Map<string, { x: number; y: number }>();
  for (const [col, ids] of buckets.entries()) {
    ids.forEach((id, rowIdx) => {
      posMap.set(id, { x: 60 + col * 300, y: 80 + rowIdx * 170 });
    });
  }

  return nodes.map((n) => ({
    ...n,
    position: posMap.get(n.id) ?? n.position,
  }));
}

export const useWorkflowStore = create<WorkflowStudioState>((set, get) => ({
  workflowId: "",
  workflowName: "",
  workflowDescription: "",
  nodes: [],
  edges: [],
  selectedNodeId: null,
  validation: {
    valid: true,
    executionOrder: [],
    cycleNodes: [],
    cycleEdges: [],
  },
  nodeStatuses: {},
  nodeLogs: {},
  isExecuting: false,
  lastRunId: null,
  lastRunDurationMs: null,
  historyPast: [],
  historyFuture: [],

  loadWorkflow: (wf) => {
    const nodes = toRfNodes(wf.nodes);
    const edges = toRfEdges(wf.edges);
    set({
      workflowId: wf.id,
      workflowName: wf.name,
      workflowDescription: wf.description,
      nodes,
      edges,
      selectedNodeId: null,
      validation: computeValidation(nodes, edges),
      nodeStatuses: {},
      nodeLogs: {},
      isExecuting: false,
      lastRunId: null,
      lastRunDurationMs: null,
      historyPast: [],
      historyFuture: [],
    });
  },

  setWorkflowMeta: (name, description) =>
    set({ workflowName: name, workflowDescription: description }),

  onNodesChange: (changes) => {
    const nextNodes = applyNodeChanges(changes, get().nodes);
    set({ nodes: nextNodes });
  },

  onEdgesChange: (changes) => {
    const state = get();
    const hasStructural = changes.some((c) => c.type === "remove");
    const nextEdges = applyEdgeChanges(changes, state.edges);
    set({
      edges: nextEdges,
      validation: computeValidation(state.nodes, nextEdges),
      ...(hasStructural
        ? { historyPast: pushSnapshot(state), historyFuture: [] }
        : {}),
    });
  },

  onConnect: (connection) => {
    const state = get();
    const nextEdges = addEdge(
      {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now().toString(36)}`,
        label: connection.sourceHandle ?? undefined,
      },
      state.edges,
    );
    set({
      historyPast: pushSnapshot(state),
      historyFuture: [],
      edges: nextEdges,
      validation: computeValidation(state.nodes, nextEdges),
    });
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  addNode: (nodeType, position) => {
    const state = get();
    const meta = NODE_TYPE_META[nodeType];
    const id = `${nodeType}-${Date.now().toString(36)}`;
    const fallbackPos = {
      x: 120 + (state.nodes.length % 4) * 260,
      y: 120 + Math.floor(state.nodes.length / 4) * 160,
    };
    const nextNode: RfNode = {
      id,
      type: "flowNode",
      position: position ?? fallbackPos,
      data: meta.createDefaultData(),
    };
    const nextNodes = [...state.nodes, nextNode];
    set({
      historyPast: pushSnapshot(state),
      historyFuture: [],
      nodes: nextNodes,
      selectedNodeId: id,
      validation: computeValidation(nextNodes, state.edges),
    });
  },

  updateNodeData: (nodeId, updater) => {
    const state = get();
    const nextNodes = state.nodes.map((node) =>
      node.id === nodeId ? { ...node, data: updater(node.data) } : node,
    );
    set({
      historyPast: pushSnapshot(state),
      historyFuture: [],
      nodes: nextNodes,
    });
  },

  deleteNode: (nodeId) => {
    const state = get();
    const nextNodes = state.nodes.filter((n) => n.id !== nodeId);
    const nextEdges = state.edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );
    set({
      historyPast: pushSnapshot(state),
      historyFuture: [],
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      validation: computeValidation(nextNodes, nextEdges),
    });
  },

  undo: () => {
    const state = get();
    const prev = state.historyPast[state.historyPast.length - 1];
    if (!prev) return;
    const remaining = state.historyPast.slice(0, -1);
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      historyPast: remaining,
      historyFuture: [
        { nodes: state.nodes, edges: state.edges },
        ...state.historyFuture.slice(0, 24),
      ],
      validation: computeValidation(prev.nodes, prev.edges),
    });
  },

  redo: () => {
    const state = get();
    const [next, ...rest] = state.historyFuture;
    if (!next) return;
    set({
      nodes: next.nodes,
      edges: next.edges,
      historyPast: pushSnapshot(state),
      historyFuture: rest,
      validation: computeValidation(next.nodes, next.edges),
    });
  },

  autoLayout: () => {
    const state = get();
    const laidOut = computeAutoLayoutPositions(state.nodes, state.edges);
    set({
      historyPast: pushSnapshot(state),
      historyFuture: [],
      nodes: laidOut,
    });
  },

  simulateCycle: () => {
    const state = get();
    const firstNode = state.nodes[0];
    const lastNode = state.nodes[state.nodes.length - 1];
    if (state.nodes.length < 2 || !firstNode || !lastNode) return;
    const order = state.validation.executionOrder;
    const sourceId = order[order.length - 1] ?? lastNode.id;
    const targetId = order[0] ?? firstNode.id;
    const cycleEdgeId = `e-cycle-${sourceId}-${targetId}`;
    if (state.edges.some((e) => e.id === cycleEdgeId)) return;

    const nextEdges: RfEdge[] = [
      ...state.edges,
      {
        id: cycleEdgeId,
        source: sourceId,
        target: targetId,
        label: "CICLO",
      },
    ];
    set({
      historyPast: pushSnapshot(state),
      historyFuture: [],
      edges: nextEdges,
      validation: computeValidation(state.nodes, nextEdges),
    });
  },

  clearCycleEdges: () => {
    const state = get();
    const cycleSet = new Set(state.validation.cycleEdges);
    const nextEdges = state.edges.filter(
      (e) => !cycleSet.has(e.id) && !e.id.startsWith("e-cycle-"),
    );
    set({
      historyPast: pushSnapshot(state),
      historyFuture: [],
      edges: nextEdges,
      validation: computeValidation(state.nodes, nextEdges),
    });
  },

  setIsExecuting: (executing) => set({ isExecuting: executing }),

  resetExecutionState: () =>
    set((state) => {
      const idleMap: Record<string, NodeExecutionStatus> = {};
      for (const n of state.nodes) idleMap[n.id] = "idle";
      return {
        nodeStatuses: idleMap,
        nodeLogs: {},
        lastRunId: null,
        lastRunDurationMs: null,
      };
    }),

  markNodeRunning: (nodeId) =>
    set((state) => ({
      nodeStatuses: { ...state.nodeStatuses, [nodeId]: "running" },
    })),

  applyNodeLog: (log) =>
    set((state) => ({
      nodeStatuses: { ...state.nodeStatuses, [log.nodeId]: log.status },
      nodeLogs: { ...state.nodeLogs, [log.nodeId]: log },
    })),

  setLastRunId: (id) => set({ lastRunId: id }),

  setLastRunDurationMs: (ms) => set({ lastRunDurationMs: ms }),

  applyReplayLogs: (logs, durationMs, runId) =>
    set(() => {
      const nodeStatuses: Record<string, NodeExecutionStatus> = {};
      const nodeLogs: Record<string, NodeExecutionLogRecord> = {};
      for (const log of logs) {
        nodeStatuses[log.nodeId] = log.status;
        nodeLogs[log.nodeId] = log;
      }
      return {
        nodeStatuses,
        nodeLogs,
        lastRunDurationMs: durationMs,
        lastRunId: runId,
      };
    }),
}));
