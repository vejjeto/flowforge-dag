"use client";

import { UiButton } from "@/components/ui/button";
import { useUiToast } from "@/components/ui/toast-provider";
import type {
  ConditionOperator,
  FlowNodeData,
  NodeExecutionLogRecord,
} from "@/contracts/workflow";
import { useWorkflowStore } from "@/store/workflow-store";
import { RotateCcw, Trash2, X } from "lucide-react";
import * as React from "react";
import { NODE_TYPE_META } from "./node-meta";

function JsonEditorField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: Record<string, unknown>;
  onSave: (parsed: Record<string, unknown>) => void;
}) {
  const [text, setText] = React.useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setError(null);
  }, [value]);

  const applyJson = () => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("Debe ser un objeto JSON valido.");
        return;
      }
      setError(null);
      onSave(parsed as Record<string, unknown>);
    } catch {
      setError("JSON invalido.");
    }
  };

  const fieldId = React.useId();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={fieldId} className="text-xs font-medium text-zinc-400">
          {label}
        </label>
        <button
          type="button"
          onClick={applyJson}
          className="rounded bg-indigo-600/20 px-2 py-0.5 text-[11px] font-medium text-indigo-400 hover:bg-indigo-600/30"
        >
          Aplicar JSON
        </button>
      </div>
      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 font-mono text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      />
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}

function NodeConfigFields({
  data,
  onChange,
}: {
  data: FlowNodeData;
  onChange: (updater: (prev: FlowNodeData) => FlowNodeData) => void;
}) {
  const inputCls =
    "w-full rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100";

  if (data.nodeType === "trigger") {
    return (
      <JsonEditorField
        label="Payload inicial (JSON)"
        value={data.payload}
        onSave={(payload) =>
          onChange((prev) =>
            prev.nodeType === "trigger" ? { ...prev, payload } : prev,
          )
        }
      />
    );
  }

  if (data.nodeType === "condition") {
    return (
      <div className="space-y-3">
        <div>
          <label
            htmlFor="node-cond-fieldpath"
            className="mb-1 block text-xs font-medium text-zinc-400"
          >
            Dot-Path del campo
          </label>
          <input
            id="node-cond-fieldpath"
            value={data.fieldPath}
            onChange={(e) =>
              onChange((prev) =>
                prev.nodeType === "condition"
                  ? { ...prev, fieldPath: e.target.value }
                  : prev,
              )
            }
            className={`${inputCls} font-mono`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="node-cond-op"
              className="mb-1 block text-xs font-medium text-zinc-400"
            >
              Operador
            </label>
            <select
              id="node-cond-op"
              value={data.operator}
              onChange={(e) =>
                onChange((prev) =>
                  prev.nodeType === "condition"
                    ? { ...prev, operator: e.target.value as ConditionOperator }
                    : prev,
                )
              }
              className={inputCls}
            >
              <option value="==">==</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value="contains">contains</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="node-cond-val"
              className="mb-1 block text-xs font-medium text-zinc-400"
            >
              Valor
            </label>
            <input
              id="node-cond-val"
              value={data.value}
              onChange={(e) =>
                onChange((prev) =>
                  prev.nodeType === "condition"
                    ? { ...prev, value: e.target.value }
                    : prev,
                )
              }
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>
      </div>
    );
  }

  if (data.nodeType === "transform") {
    return (
      <JsonEditorField
        label="Plantilla JSON ({{input.path}})"
        value={data.template}
        onSave={(template) =>
          onChange((prev) =>
            prev.nodeType === "transform" ? { ...prev, template } : prev,
          )
        }
      />
    );
  }

  if (data.nodeType === "http") {
    return (
      <div className="space-y-3">
        <div>
          <label
            htmlFor="node-http-method"
            className="mb-1 block text-xs font-medium text-zinc-400"
          >
            Metodo
          </label>
          <select
            id="node-http-method"
            value={data.method}
            onChange={(e) =>
              onChange((prev) =>
                prev.nodeType === "http"
                  ? { ...prev, method: e.target.value as "GET" | "POST" }
                  : prev,
              )
            }
            className={inputCls}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="node-http-url"
            className="mb-1 block text-xs font-medium text-zinc-400"
          >
            URL Destino (Anti-SSRF)
          </label>
          <input
            id="node-http-url"
            value={data.url}
            onChange={(e) =>
              onChange((prev) =>
                prev.nodeType === "http"
                  ? { ...prev, url: e.target.value }
                  : prev,
              )
            }
            className={`${inputCls} font-mono`}
          />
        </div>
      </div>
    );
  }

  if (data.nodeType === "ai_summary") {
    return (
      <div>
        <label
          htmlFor="node-ai-prompt"
          className="mb-1 block text-xs font-medium text-zinc-400"
        >
          Prompt de analisis
        </label>
        <textarea
          id="node-ai-prompt"
          rows={4}
          value={data.prompt}
          onChange={(e) =>
            onChange((prev) =>
              prev.nodeType === "ai_summary"
                ? { ...prev, prompt: e.target.value }
                : prev,
            )
          }
          className={inputCls}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="node-log-channel"
          className="mb-1 block text-xs font-medium text-zinc-400"
        >
          Canal
        </label>
        <input
          id="node-log-channel"
          value={data.channel}
          onChange={(e) =>
            onChange((prev) =>
              prev.nodeType === "log_notify"
                ? { ...prev, channel: e.target.value }
                : prev,
            )
          }
          className={inputCls}
        />
      </div>
      <div>
        <label
          htmlFor="node-log-msg"
          className="mb-1 block text-xs font-medium text-zinc-400"
        >
          Mensaje Template
        </label>
        <textarea
          id="node-log-msg"
          rows={3}
          value={data.messageTemplate}
          onChange={(e) =>
            onChange((prev) =>
              prev.nodeType === "log_notify"
                ? { ...prev, messageTemplate: e.target.value }
                : prev,
            )
          }
          className={`${inputCls} font-mono`}
        />
      </div>
    </div>
  );
}

export function NodeInspectorDrawer() {
  const { pushToast } = useUiToast();
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const nodeLogs = useWorkflowStore((s) => s.nodeLogs);
  const lastRunId = useWorkflowStore((s) => s.lastRunId);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const applyReplayLogs = useWorkflowStore((s) => s.applyReplayLogs);
  const [tab, setTab] = React.useState<"io" | "config">("io");
  const [replaying, setReplaying] = React.useState(false);

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const log = nodeLogs[node.id];
  const meta = NODE_TYPE_META[node.data.nodeType];

  const handleReplayFromNode = async () => {
    if (!lastRunId || replaying) return;
    setReplaying(true);
    try {
      const res = await fetch(`/api/runs/${lastRunId}/replay-from/${node.id}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        run: { id: string; status: string; totalDurationMs: number };
        nodeLogs: NodeExecutionLogRecord[];
      };
      applyReplayLogs(data.nodeLogs, data.run.totalDurationMs, data.run.id);
      pushToast({
        title: `Replay desde ${node.id}: ${data.run.status.toUpperCase()}`,
        description: `Checkpoints upstream reutilizados (${data.run.totalDurationMs}ms)`,
        variant: data.run.status === "success" ? "success" : "error",
      });
    } catch (err) {
      pushToast({
        title: "Error al re-ejecutar desde este nodo",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setReplaying(false);
    }
  };

  return (
    <aside
      data-testid="node-inspector"
      className="flex h-full w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:w-96"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0">
          <span
            className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
          >
            {meta.title}
          </span>
          <h3 className="mt-1 truncate text-sm font-semibold">
            {node.data.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => selectNode(null)}
          aria-label="Cerrar inspector"
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex border-b border-zinc-200 px-4 text-xs dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setTab("io")}
          className={`border-b-2 px-3 py-2 font-medium transition ${
            tab === "io"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Input vs Output JSON
        </button>
        <button
          type="button"
          onClick={() => setTab("config")}
          className={`border-b-2 px-3 py-2 font-medium transition ${
            tab === "config"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Configuracion
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {tab === "io" ? (
          log ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                <span className="font-medium">
                  Estado: {log.status.toUpperCase()}
                </span>
                <span className="font-mono text-zinc-400">
                  {log.durationMs} ms
                </span>
              </div>
              {lastRunId && (
                <UiButton
                  data-testid="replay-from-node-btn"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleReplayFromNode}
                  loading={replaying}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Re-ejecutar desde este nodo
                </UiButton>
              )}
              {log.errorMessage && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                  {log.errorMessage}
                </div>
              )}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Input JSON
                </p>
                <pre className="max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-[11px] dark:border-zinc-800 dark:bg-zinc-900">
                  {JSON.stringify(log.inputJson, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Output JSON
                </p>
                <pre className="max-h-56 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-[11px] dark:border-zinc-800 dark:bg-zinc-900">
                  {JSON.stringify(log.outputJson, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
              Ejecuta el flujo para inspeccionar el Input JSON vs Output JSON de
              este nodo.
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="node-inspector-label"
                className="mb-1 block text-xs font-medium text-zinc-400"
              >
                Nombre del nodo
              </label>
              <input
                id="node-inspector-label"
                value={node.data.label}
                onChange={(e) =>
                  updateNodeData(node.id, (prev) => ({
                    ...prev,
                    label: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <NodeConfigFields
              data={node.data}
              onChange={(updater) => updateNodeData(node.id, updater)}
            />
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <UiButton
          variant="danger"
          size="sm"
          className="w-full"
          onClick={() => deleteNode(node.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar nodo
        </UiButton>
      </div>
    </aside>
  );
}
