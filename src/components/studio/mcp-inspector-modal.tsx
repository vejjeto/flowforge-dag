"use client";

import { UiButton } from "@/components/ui/button";
import { Play, Terminal, X } from "lucide-react";
import * as React from "react";

type McpToolName =
  | "list_workflows"
  | "validate_dag"
  | "run_workflow"
  | "get_run_logs";

const TOOL_DEFAULT_ARGS: Record<McpToolName, string> = {
  list_workflows: "{}",
  validate_dag: JSON.stringify(
    { workflowId: "wf-ecommerce-order-alert" },
    null,
    2,
  ),
  run_workflow: JSON.stringify(
    {
      workflowId: "wf-ecommerce-order-alert",
      triggerPayload: { order: { total: 249.5 } },
    },
    null,
    2,
  ),
  get_run_logs: JSON.stringify(
    { workflowId: "wf-ecommerce-order-alert", limit: 3 },
    null,
    2,
  ),
};

export function McpInspectorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [toolName, setToolName] = React.useState<McpToolName>("list_workflows");
  const [argsText, setArgsText] = React.useState<string>(
    TOOL_DEFAULT_ARGS.list_workflows,
  );
  const [responseText, setResponseText] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  if (!open) return null;

  const handleSelectTool = (next: McpToolName) => {
    setToolName(next);
    setArgsText(TOOL_DEFAULT_ARGS[next]);
  };

  const handleInvoke = async () => {
    setLoading(true);
    try {
      const parsedArgs = JSON.parse(argsText) as Record<string, unknown>;
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: toolName, arguments: parsedArgs },
        }),
      });
      const json = (await res.json()) as unknown;
      setResponseText(JSON.stringify(json, null, 2));
    } catch (err) {
      setResponseText(
        JSON.stringify(
          {
            error:
              err instanceof Error ? err.message : "Error invoking /api/mcp",
          },
          null,
          2,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="mcp-inspector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold">
              MCP Inspector (JSON-RPC 2.0)
            </h2>
            <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] text-indigo-400">
              POST /api/mcp
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar MCP Inspector"
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TOOL_DEFAULT_ARGS) as McpToolName[]).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => handleSelectTool(name)}
                className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition ${
                  toolName === name
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div>
            <label
              htmlFor="mcp-args-input"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
            >
              Arguments (JSON)
            </label>
            <textarea
              id="mcp-args-input"
              rows={4}
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              spellCheck={false}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 font-mono text-xs text-zinc-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end">
            <UiButton size="sm" onClick={handleInvoke} loading={loading}>
              <Play className="h-3.5 w-3.5" />
              Ejecutar Tool MCP
            </UiButton>
          </div>

          {responseText && (
            <div>
              <p className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                JSON-RPC Response
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-[11px] text-emerald-300">
                {responseText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
