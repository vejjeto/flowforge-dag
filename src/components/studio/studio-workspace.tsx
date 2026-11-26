"use client";

import { UiButton } from "@/components/ui/button";
import { HealthBadge } from "@/components/ui/health-badge";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useUiToast } from "@/components/ui/toast-provider";
import type {
  FlowNodeType,
  NodeExecutionLogRecord,
  WorkflowRecord,
} from "@/contracts/workflow";
import { useLocale } from "@/lib/i18n";
import { toContractGraph, useWorkflowStore } from "@/store/workflow-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import {
  AlertTriangle,
  BookOpen,
  FolderKanban,
  LayoutGrid,
  Moon,
  Play,
  Plus,
  Redo2,
  Save,
  ShieldAlert,
  Sun,
  Terminal,
  Undo2,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { FlowNodeCard } from "./flow-node";
import { McpInspectorModal } from "./mcp-inspector-modal";
import { NodeInspectorDrawer } from "./node-inspector";
import { NODE_TYPE_LIST } from "./node-meta";

const nodeTypes = { flowNode: FlowNodeCard };

interface ExecuteCompletePayload {
  run: { id: string; status: string; totalDurationMs: number };
  nodeLogs: NodeExecutionLogRecord[];
}

function StudioCanvas({
  triggerPayloadText,
  onTriggerPayloadChange,
}: {
  triggerPayloadText: string;
  onTriggerPayloadChange: (next: string) => void;
}) {
  const { t } = useLocale();
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const validation = useWorkflowStore((s) => s.validation);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);
  const nodeStatuses = useWorkflowStore((s) => s.nodeStatuses);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const addNode = useWorkflowStore((s) => s.addNode);
  const clearCycleEdges = useWorkflowStore((s) => s.clearCycleEdges);

  const styledEdges = React.useMemo<Edge[]>(() => {
    const cycleSet = new Set(validation.cycleEdges);
    return edges.map((edge) => {
      const isCycle = cycleSet.has(edge.id);
      const sourceStatus = nodeStatuses[edge.source];
      const targetStatus = nodeStatuses[edge.target];
      const isLive =
        isExecuting || sourceStatus === "running" || targetStatus === "running";
      const isSuccessFlow =
        sourceStatus === "success" && targetStatus === "success";

      return {
        ...edge,
        animated: isCycle || isLive,
        style: isCycle
          ? { stroke: "#f43f5e", strokeWidth: 2.5 }
          : isSuccessFlow
            ? { stroke: "#10b981", strokeWidth: 2 }
            : { stroke: "#6366f1", strokeWidth: 1.75 },
      };
    });
  }, [edges, validation.cycleEdges, nodeStatuses, isExecuting]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rawType = event.dataTransfer.getData(
      "application/flowforge-node",
    ) as FlowNodeType;
    if (!rawType) return;
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    addNode(rawType, position);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/80 md:flex">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {t.nodePalette}
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-500">{t.dragOrClickToAdd}</p>

        <div className="mt-2.5 space-y-1.5">
          {NODE_TYPE_LIST.map((item) => (
            <button
              key={item.type}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/flowforge-node", item.type);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => addNode(item.type)}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-left transition hover:border-indigo-500/60 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {item.title}
                </p>
                <p className="truncate text-[10px] text-zinc-500">
                  {item.description}
                </p>
              </div>
              <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-1 flex-col">
          <label
            htmlFor="trigger-payload-json"
            className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            {t.triggerPayloadLabel}
          </label>
          <textarea
            id="trigger-payload-json"
            value={triggerPayloadText}
            onChange={(e) => onTriggerPayloadChange(e.target.value)}
            spellCheck={false}
            className="mt-1.5 flex-1 resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-[11px] text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </aside>

      <div
        className="relative flex-1 bg-zinc-100/70 dark:bg-[#09090b]"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={handleDrop}
      >
        {!validation.valid && (
          <div
            data-testid="cycle-alert"
            className="absolute left-4 right-4 top-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/50 bg-rose-950/90 px-3.5 py-2 text-xs text-rose-100 shadow-lg backdrop-blur"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>
                <strong>{t.dagCycleDetected}</strong> {t.conflictingNodes} (
                {validation.cycleNodes.join(", ")})
              </span>
            </div>
            <button
              type="button"
              onClick={clearCycleEdges}
              className="rounded-md bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-400"
            >
              {t.removeCycleEdges}
            </button>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_ev, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(null)}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} size={1} color="#27272a" />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      <NodeInspectorDrawer />
    </div>
  );
}

export function StudioWorkspace({
  initialWorkflows,
  initialSelectedId,
  autoRunDemo = false,
}: {
  initialWorkflows: WorkflowRecord[];
  initialSelectedId?: string | undefined;
  autoRunDemo?: boolean;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useUiToast();
  const { t } = useLocale();

  const workflowsQuery = useQuery({
    queryKey: ["workflows"],
    queryFn: async (): Promise<WorkflowRecord[]> => {
      const res = await fetch("/api/workflows");
      const data = (await res.json()) as { workflows: WorkflowRecord[] };
      return data.workflows;
    },
    initialData: initialWorkflows,
  });

  const workflowId = useWorkflowStore((s) => s.workflowId);
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const validation = useWorkflowStore((s) => s.validation);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);
  const lastRunDurationMs = useWorkflowStore((s) => s.lastRunDurationMs);
  const nodeLogs = useWorkflowStore((s) => s.nodeLogs);
  const historyPast = useWorkflowStore((s) => s.historyPast);
  const historyFuture = useWorkflowStore((s) => s.historyFuture);

  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const autoLayout = useWorkflowStore((s) => s.autoLayout);
  const simulateCycle = useWorkflowStore((s) => s.simulateCycle);
  const setIsExecuting = useWorkflowStore((s) => s.setIsExecuting);
  const resetExecutionState = useWorkflowStore((s) => s.resetExecutionState);
  const markNodeRunning = useWorkflowStore((s) => s.markNodeRunning);
  const applyNodeLog = useWorkflowStore((s) => s.applyNodeLog);
  const setLastRunId = useWorkflowStore((s) => s.setLastRunId);
  const setLastRunDurationMs = useWorkflowStore((s) => s.setLastRunDurationMs);

  const [triggerPayloadText, setTriggerPayloadText] = React.useState("{}");
  const [mcpOpen, setMcpOpen] = React.useState(false);
  const autoRanRef = React.useRef(false);

  React.useEffect(() => {
    const list = workflowsQuery.data;
    if (!list.length || workflowId) return;
    const chosen =
      (initialSelectedId && list.find((w) => w.id === initialSelectedId)) ||
      list.find((w) => w.id === "wf-ecommerce-order-alert") ||
      list[0];
    if (chosen) {
      loadWorkflow(chosen);
      const triggerNode = chosen.nodes.find(
        (n) => n.data.nodeType === "trigger",
      );
      if (triggerNode && triggerNode.data.nodeType === "trigger") {
        setTriggerPayloadText(
          JSON.stringify(triggerNode.data.payload, null, 2),
        );
      }
    }
  }, [workflowsQuery.data, workflowId, initialSelectedId, loadWorkflow]);

  const handleSelectWorkflow = (id: string) => {
    const wf = workflowsQuery.data.find((w) => w.id === id);
    if (!wf) return;
    loadWorkflow(wf);
    const triggerNode = wf.nodes.find((n) => n.data.nodeType === "trigger");
    if (triggerNode && triggerNode.data.nodeType === "trigger") {
      setTriggerPayloadText(JSON.stringify(triggerNode.data.payload, null, 2));
    } else {
      setTriggerPayloadText("{}");
    }
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    root.classList.toggle("dark", !isDark);
    try {
      localStorage.setItem("theme", isDark ? "light" : "dark");
    } catch {
      // Ignore storage error
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const contract = toContractGraph(nodes, edges);
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName,
          nodes: contract.nodes,
          edges: contract.edges,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el workflow");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      pushToast({ title: "Workflow guardado", variant: "success" });
    },
    onError: (err) => {
      pushToast({
        title: "Error al guardar",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    },
  });

  const handleRunDemo = async () => {
    if (!workflowId || isExecuting) return;
    if (!validation.valid) {
      pushToast({
        title: "Grafo invalido: ciclo detectado",
        description: `Corrige las aristas en conflicto (${validation.cycleNodes.join(", ")})`,
        variant: "error",
      });
      return;
    }

    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(triggerPayloadText) as Record<string, unknown>;
    } catch {
      pushToast({ title: "Trigger JSON invalido", variant: "error" });
      return;
    }

    resetExecutionState();
    setIsExecuting(true);

    try {
      const contract = toContractGraph(nodes, edges);
      const response = await fetch(
        `/api/workflows/${workflowId}/execute?stream=1`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            triggerPayload: parsedPayload,
            nodes: contract.nodes,
            edges: contract.edges,
          }),
        },
      );

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const eventLine = chunk
            .split("\n")
            .find((l) => l.startsWith("event: "));
          const dataLine = chunk
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const eventName = eventLine.slice(7).trim();
          const payload = JSON.parse(dataLine.slice(6)) as Record<
            string,
            unknown
          >;

          if (eventName === "node:start") {
            markNodeRunning(String(payload.nodeId));
          } else if (eventName === "node:complete") {
            applyNodeLog(payload.log as NodeExecutionLogRecord);
          } else if (eventName === "run:complete") {
            const complete = payload as unknown as ExecuteCompletePayload;
            setLastRunId(complete.run.id);
            setLastRunDurationMs(complete.run.totalDurationMs);
            const firstCompleted = complete.nodeLogs.find(
              (l) => l.status !== "skipped",
            );
            if (firstCompleted) selectNode(firstCompleted.nodeId);
            pushToast({
              title: `Ejecucion ${complete.run.status.toUpperCase()} (${complete.run.totalDurationMs}ms)`,
              description: `${complete.nodeLogs.length} nodos procesados en orden topologico Kahn`,
              variant: complete.run.status === "success" ? "success" : "error",
            });
          }
        }
      }
    } catch (err) {
      pushToast({
        title: "Fallo al ejecutar el flujo",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  React.useEffect(() => {
    if (autoRunDemo && workflowId && !autoRanRef.current) {
      autoRanRef.current = true;
      void handleRunDemo();
    }
  });

  const logSummaryList = Object.values(nodeLogs);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-[#09090b] dark:text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Workflow className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-sm font-bold tracking-tight">FlowForge</h1>
              <p className="text-[10px] text-zinc-500">
                Visual DAG Automation Studio
              </p>
            </div>
          </div>

          <select
            aria-label={t.selectWorkflowAria}
            value={workflowId}
            onChange={(e) => handleSelectWorkflow(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {workflowsQuery.data.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name}
              </option>
            ))}
          </select>

          <HealthBadge />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <UiButton
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={historyPast.length === 0}
            title={t.undo}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </UiButton>
          <UiButton
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={historyFuture.length === 0}
            title={t.redo}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </UiButton>
          <UiButton
            variant="outline"
            size="sm"
            onClick={autoLayout}
            title={t.autoLayoutTitle}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.autoLayout}</span>
          </UiButton>
          <UiButton
            variant="outline"
            size="sm"
            onClick={simulateCycle}
            title={t.simulateCycle}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            <span className="hidden lg:inline">{t.simulateCycle}</span>
          </UiButton>
          <UiButton
            variant="secondary"
            size="sm"
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.save}</span>
          </UiButton>
          <UiButton
            data-testid="run-demo-btn"
            variant="primary"
            size="sm"
            onClick={handleRunDemo}
            loading={isExecuting}
          >
            <Play className="h-3.5 w-3.5" />
            {t.runDemo}
          </UiButton>

          <UiButton
            data-testid="mcp-inspector-btn"
            variant="outline"
            size="sm"
            onClick={() => setMcpOpen(true)}
            title={t.mcpInspectorTitle}
          >
            <Terminal className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden xl:inline">{t.mcpInspector}</span>
          </UiButton>
          <Link
            href="/workflows"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <FolderKanban className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">{t.workflows}</span>
          </Link>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">API</span>
          </a>
          <LanguageToggle />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={t.toggleThemeAria}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <Moon className="hidden h-3.5 w-3.5 dark:inline" />
            <Sun className="h-3.5 w-3.5 dark:hidden" />
          </button>
        </div>
      </header>

      <ReactFlowProvider>
        <StudioCanvas
          triggerPayloadText={triggerPayloadText}
          onTriggerPayloadChange={setTriggerPayloadText}
        />
      </ReactFlowProvider>

      {logSummaryList.length > 0 && (
        <footer
          data-testid="execution-logs-bar"
          className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-white px-4 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-400">
              {t.executionLogs}
            </span>
            {logSummaryList.map((log) => (
              <button
                key={log.nodeId}
                type="button"
                onClick={() => selectNode(log.nodeId)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition hover:opacity-85 ${
                  log.status === "success"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : log.status === "skipped"
                      ? "border-zinc-700 bg-zinc-800/60 text-zinc-400"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-400"
                }`}
              >
                <span>{log.nodeId}</span>
                <span>({log.status})</span>
                <span>{log.durationMs}ms</span>
              </button>
            ))}
          </div>
          {lastRunDurationMs !== null && (
            <span className="font-mono text-[11px] text-zinc-400">
              Total DAG: {lastRunDurationMs} ms
            </span>
          )}
        </footer>
      )}

      <McpInspectorModal open={mcpOpen} onClose={() => setMcpOpen(false)} />
    </div>
  );
}
