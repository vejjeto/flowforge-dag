"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";

interface HealthPayload {
  status: string;
  db?: { ok: boolean; latencyMs?: number };
}

export function HealthBadge() {
  const { data, isError } = useQuery({
    queryKey: ["flowforge-health"],
    queryFn: async (): Promise<HealthPayload> => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("Health check failed");
      return (await res.json()) as HealthPayload;
    },
    refetchInterval: 30_000,
    retry: false,
  });

  const isOk = !isError && data?.status === "ok";

  return (
    <span
      title={
        isOk ? `SQLite OK (${data?.db?.latencyMs ?? 1}ms)` : "API desconectada"
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${
        isOk
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
          : "border-rose-500/30 bg-rose-500/10 text-rose-500 dark:text-rose-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isOk ? "bg-emerald-500" : "bg-rose-500"}`}
      />
      {isOk ? "API OK" : "Offline"}
    </span>
  );
}
