import type {
  DagValidationResult,
  FlowEdge,
  FlowNode,
} from "@/contracts/workflow";

interface GraphIndex {
  nodeIds: string[];
  adjacency: Map<string, string[]>;
  inDegree: Map<string, number>;
}

function buildGraphIndex(nodes: FlowNode[], edges: FlowEdge[]): GraphIndex {
  const nodeIds = nodes.map((n) => n.id);
  const nodeSet = new Set(nodeIds);
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  return { nodeIds, adjacency, inDegree };
}

/**
 * Groups independent DAG nodes into deterministic topological levels using Kahn's O(V + E) algorithm.
 * Nodes within the same level have no dependencies on each other and can execute concurrently.
 */
export function computeTopologicalLevels(
  nodes: FlowNode[],
  edges: FlowEdge[],
): string[][] {
  const { nodeIds, adjacency, inDegree } = buildGraphIndex(nodes, edges);
  const orderIndex = new Map(nodeIds.map((id, idx) => [id, idx]));
  let currentLevel = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const levels: string[][] = [];

  while (currentLevel.length > 0) {
    currentLevel.sort(
      (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
    );
    levels.push(currentLevel);

    const nextLevel: string[] = [];
    for (const current of currentLevel) {
      for (const next of adjacency.get(current) ?? []) {
        const nextDegree = (inDegree.get(next) ?? 0) - 1;
        inDegree.set(next, nextDegree);
        if (nextDegree === 0) {
          nextLevel.push(next);
        }
      }
    }
    currentLevel = nextLevel;
  }

  return levels;
}

/**
 * Deterministic O(V + E) Kahn's topological sort.
 * Returns the ordered node IDs (partial order if cycles exist).
 */
export function topologicalSortKahn(
  nodes: FlowNode[],
  edges: FlowEdge[],
): string[] {
  return computeTopologicalLevels(nodes, edges).flat();
}

function hasSelfLoop(nodeId: string, edges: FlowEdge[]): boolean {
  return edges.some((edge) => edge.source === nodeId && edge.target === nodeId);
}

function findCyclicSccs(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
  edges: FlowEdge[],
): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cyclicComponents: string[][] = [];

  function strongConnect(v: string): void {
    indices.set(v, index);
    lowlink.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(w) ?? 0));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, indices.get(w) ?? 0));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const component: string[] = [];
      while (stack.length > 0) {
        const w = stack.pop() as string;
        onStack.delete(w);
        component.push(w);
        if (w === v) break;
      }
      const firstId = component[0];
      if (
        component.length > 1 ||
        (component.length === 1 &&
          firstId !== undefined &&
          hasSelfLoop(firstId, edges))
      ) {
        cyclicComponents.push(component);
      }
    }
  }

  for (const id of nodeIds) {
    if (!indices.has(id)) {
      strongConnect(id);
    }
  }

  return cyclicComponents;
}

/**
 * Validates a workflow graph as a DAG, returning execution order and exact cycle nodes/edges.
 */
export function validateDag(
  nodes: FlowNode[],
  edges: FlowEdge[],
): DagValidationResult {
  const executionOrder = topologicalSortKahn(nodes, edges);
  if (executionOrder.length === nodes.length) {
    return { valid: true, executionOrder, cycleNodes: [], cycleEdges: [] };
  }

  const { nodeIds, adjacency } = buildGraphIndex(nodes, edges);
  const cyclicComponents = findCyclicSccs(nodeIds, adjacency, edges);
  const cycleNodeSet = new Set<string>();
  const componentOf = new Map<string, number>();

  cyclicComponents.forEach((comp, idx) => {
    for (const id of comp) {
      cycleNodeSet.add(id);
      componentOf.set(id, idx);
    }
  });

  const cycleNodes = nodeIds.filter((id) => cycleNodeSet.has(id));
  const cycleEdges = edges
    .filter((edge) => {
      const srcComp = componentOf.get(edge.source);
      const tgtComp = componentOf.get(edge.target);
      return srcComp !== undefined && srcComp === tgtComp;
    })
    .map((edge) => edge.id);

  return {
    valid: false,
    executionOrder,
    cycleNodes,
    cycleEdges,
  };
}
