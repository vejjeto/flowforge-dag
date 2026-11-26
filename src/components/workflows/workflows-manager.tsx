"use client";

import { NODE_TYPE_META } from "@/components/studio/node-meta";
import { UiButton } from "@/components/ui/button";
import { HealthBadge } from "@/components/ui/health-badge";
import { useUiToast } from "@/components/ui/toast-provider";
import type { WorkflowRecord, WorkflowRunRecord } from "@/contracts/workflow";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Plus,
  RotateCcw,
  Trash2,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

export function WorkflowsManager({
  initialWorkflows,
}: {
  initialWorkflows: WorkflowRecord[];
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useUiToast();
  const [selectedId, setSelectedId] = React.useState<string>(
    initialWorkflows[0]?.id ?? "",
  );
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");

  const workflowsQuery = useQuery({
    queryKey: ["workflows"],
    queryFn: async (): Promise<WorkflowRecord[]> => {
      const res = await fetch("/api/workflows");
      const data = (await res.json()) as { workflows: WorkflowRecord[] };
      return data.workflows;
    },
    initialData: initialWorkflows,
  });

  const detailQuery = useQuery({
    queryKey: ["workflow-detail", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async (): Promise<{
      workflow: WorkflowRecord;
      runs: WorkflowRunRecord[];
    }> => {
      const res = await fetch(`/api/workflows/${selectedId}`);
      return res.json() as Promise<{
        workflow: WorkflowRecord;
        runs: WorkflowRunRecord[];
      }>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim() || "Nuevo Workflow DAG",
          description: newDesc.trim() || "Flujo creado desde FlowForge",
          nodes: [
            {
              id: "trigger-new",
              type: "flowNode",
              position: { x: 80, y: 160 },
              data: NODE_TYPE_META.trigger.createDefaultData(),
            },
            {
              id: "log-new",
              type: "flowNode",
              position: { x: 400, y: 160 },
              data: NODE_TYPE_META.log_notify.createDefaultData(),
            },
          ],
          edges: [
            {
              id: "e-trigger-log-new",
              source: "trigger-new",
              target: "log-new",
            },
          ],
        }),
      });
      if (!res.ok) throw new Error("Error al crear workflow");
      return (await res.json()) as { workflow: WorkflowRecord };
    },
    onSuccess: ({ workflow }) => {
      setNewName("");
      setNewDesc("");
      setSelectedId(workflow.id);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      pushToast({
        title: `Workflow "${workflow.name}" creado`,
        variant: "success",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      if (selectedId === deletedId) setSelectedId("");
      pushToast({ title: "Workflow eliminado", variant: "info" });
    },
  });

  const replayMutation = useMutation({
    mutationFn: async ({
      runId,
      nodeId,
    }: { runId: string; nodeId: string }) => {
      const res = await fetch(`/api/runs/${runId}/replay-from/${nodeId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Error al re-ejecutar desde nodo");
      return res.json() as Promise<{ run: WorkflowRunRecord }>;
    },
    onSuccess: ({ run }) => {
      queryClient.invalidateQueries({
        queryKey: ["workflow-detail", selectedId],
      });
      pushToast({
        title: `Replay ${run.status.toUpperCase()} (${run.totalDurationMs}ms)`,
        variant: run.status === "success" ? "success" : "error",
      });
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#09090b] dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al Studio
            </Link>
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-indigo-500" />
              <h1 className="text-base font-bold">
                Workflows e Historial de Ejecuciones
              </h1>
            </div>
          </div>
          <HealthBadge />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Crear nuevo workflow
            </h2>
            <div className="mt-3 space-y-2.5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre del flujo..."
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descripcion breve..."
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
              />
              <UiButton
                size="sm"
                onClick={() => createMutation.mutate()}
                loading={createMutation.isPending}
              >
                <Plus className="h-3.5 w-3.5" />
                Crear Workflow
              </UiButton>
            </div>
          </div>

          <div className="space-y-2">
            {workflowsQuery.data.map((wf) => (
              <div
                key={wf.id}
                className={`rounded-xl border p-4 transition ${
                  selectedId === wf.id
                    ? "border-indigo-500 bg-indigo-500/5"
                    : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(wf.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{wf.name}</h3>
                      {wf.isDemo && (
                        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                          DEMO
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {wf.description}
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-zinc-400">
                      {wf.nodes.length} nodos · {wf.edges.length} aristas
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/?id=${encodeURIComponent(wf.id)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg p-1.5 text-indigo-400 hover:bg-indigo-500/10"
                      title="Abrir en Studio"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    {!wf.isDemo && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(wf.id);
                        }}
                        className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"
                        title="Eliminar workflow"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-7">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold">Historial de Ejecuciones</h2>
            {!detailQuery.data?.runs?.length ? (
              <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
                Aun no hay ejecuciones registradas para este workflow. Ejecutalo
                desde el Studio.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {detailQuery.data.runs.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                            run.status === "success"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {run.status.toUpperCase()}
                        </span>
                        <span className="font-mono text-zinc-400">
                          {run.id}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                        <Clock className="h-3 w-3" />
                        {run.totalDurationMs} ms ·{" "}
                        {new Date(run.startedAt).toLocaleString()}
                      </span>
                    </div>
                    {run.nodeLogs && run.nodeLogs.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {run.nodeLogs.map((log) => (
                          <span
                            key={`${run.id}-${log.nodeId}`}
                            className="inline-flex items-center gap-1.5 rounded border border-zinc-700/60 bg-zinc-950/60 px-2 py-0.5 font-mono text-[10px] text-zinc-300"
                          >
                            <span>
                              {log.nodeId}: {log.status} ({log.durationMs}ms)
                            </span>
                            <button
                              type="button"
                              title="Re-ejecutar desde este nodo"
                              onClick={() =>
                                replayMutation.mutate({
                                  runId: run.id,
                                  nodeId: log.nodeId,
                                })
                              }
                              className="inline-flex items-center gap-0.5 rounded bg-indigo-500/20 px-1 py-0.5 text-[9px] text-indigo-300 hover:bg-indigo-500/35"
                            >
                              <RotateCcw className="h-2.5 w-2.5" />
                              Re-ejecutar desde este nodo
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
