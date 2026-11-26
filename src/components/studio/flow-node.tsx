"use client";

import type {
  FlowNodeData,
  FlowNodeType,
  NodeExecutionStatus,
} from "@/contracts/workflow";
import { type RfNode, useWorkflowStore } from "@/store/workflow-store";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import {
  Bell,
  Braces,
  GitBranch,
  Globe,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import type * as React from "react";
import { NODE_TYPE_META } from "./node-meta";

const NODE_ICONS: Record<
  FlowNodeType,
  React.ComponentType<{ className?: string }>
> = {
  trigger: PlayCircle,
  condition: GitBranch,
  transform: Braces,
  http: Globe,
  ai_summary: Sparkles,
  log_notify: Bell,
};

function summarizeNodeData(data: FlowNodeData): string {
  switch (data.nodeType) {
    case "trigger":
      return `${Object.keys(data.payload).length} claves JSON`;
    case "condition":
      return `${data.fieldPath} ${data.operator} ${data.value}`;
    case "transform":
      return `${Object.keys(data.template).length} campos proyectados`;
    case "http":
      return `${data.method} ${data.url}`;
    case "ai_summary":
      return data.prompt;
    case "log_notify":
      return `#${data.channel}`;
  }
}

const STATUS_BADGE: Record<
  NodeExecutionStatus,
  { label: string; cls: string }
> = {
  idle: { label: "idle", cls: "bg-zinc-800/70 text-zinc-400 border-zinc-700" },
  running: {
    label: "running...",
    cls: "bg-indigo-500/20 text-indigo-300 border-indigo-400/50 animate-pulse",
  },
  success: {
    label: "ok",
    cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  failed: {
    label: "failed",
    cls: "bg-rose-500/20 text-rose-300 border-rose-500/50",
  },
  skipped: {
    label: "skipped",
    cls: "bg-zinc-800/60 text-zinc-500 border-zinc-700/60",
  },
};

export function FlowNodeCard({ id, data, selected }: NodeProps<RfNode>) {
  const status = useWorkflowStore((s) => s.nodeStatuses[id] ?? "idle");
  const log = useWorkflowStore((s) => s.nodeLogs[id]);
  const cycleNodes = useWorkflowStore((s) => s.validation.cycleNodes);
  const isCycleConflict = cycleNodes.includes(id);

  const meta = NODE_TYPE_META[data.nodeType];
  const Icon = NODE_ICONS[data.nodeType];
  const statusInfo = STATUS_BADGE[status];

  return (
    <div
      data-testid={`flow-node-${id}`}
      className={`w-64 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur transition-all dark:bg-zinc-900/95 ${
        isCycleConflict
          ? "border-rose-500 ring-2 ring-rose-500/50 shadow-rose-500/20"
          : selected
            ? "border-indigo-500 ring-2 ring-indigo-500/40"
            : status === "running"
              ? "border-indigo-400 ring-2 ring-indigo-400/40"
              : status === "success"
                ? "border-emerald-500/60"
                : status === "skipped"
                  ? "border-zinc-700/60 opacity-60"
                  : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {data.nodeType !== "trigger" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-zinc-900 !bg-indigo-400"
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${meta.badgeClass}`}
        >
          <Icon className="h-3 w-3" />
          {meta.shortTag}
        </span>

        <span
          data-testid={`node-status-${id}`}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusInfo.cls}`}
        >
          {statusInfo.label}
          {log && status !== "idle" && status !== "skipped"
            ? ` · ${log.durationMs}ms`
            : ""}
        </span>
      </div>

      <p className="mt-2 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {data.label}
      </p>
      <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        {summarizeNodeData(data)}
      </p>

      {isCycleConflict && (
        <p className="mt-1.5 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">
          Conflicto de ciclo DAG
        </p>
      )}

      {data.nodeType === "condition" ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            style={{ top: "36%" }}
            className="!h-3 !w-3 !border-2 !border-zinc-900 !bg-emerald-400"
          />
          <span className="pointer-events-none absolute -right-11 top-[28%] rounded bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-400">
            TRUE
          </span>
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: "74%" }}
            className="!h-3 !w-3 !border-2 !border-zinc-900 !bg-amber-400"
          />
          <span className="pointer-events-none absolute -right-12 top-[66%] rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-400">
            FALSE
          </span>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-zinc-900 !bg-indigo-400"
        />
      )}
    </div>
  );
}
