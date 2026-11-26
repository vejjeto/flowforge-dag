"use client";

import { Command, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  href: string;
}

const DEFAULT_ACTIONS: PaletteAction[] = [
  { id: "studio", label: "Abrir Studio DAG", hint: "/", href: "/" },
  {
    id: "demo",
    label: "Modo Demo Interactivo (1-Click)",
    hint: "/demo",
    href: "/demo",
  },
  {
    id: "workflows",
    label: "Gestor de Workflows e Historial",
    hint: "/workflows",
    href: "/workflows",
  },
  {
    id: "docs",
    label: "Documentacion OpenAPI",
    hint: "/api/docs",
    href: "/api/docs",
  },
];

export function CommandPalette({
  extraActions = [],
}: { extraActions?: PaletteAction[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  const actions = [...DEFAULT_ACTIONS, ...extraActions].filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2.5">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ir a vista o accion (Ctrl+K)..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-zinc-500"
          />
          <kbd className="inline-flex items-center gap-0.5 rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {actions.length === 0 ? (
            <p className="p-3 text-center text-xs text-zinc-500">
              Sin resultados
            </p>
          ) : (
            actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (action.href.startsWith("/api/")) {
                    window.open(action.href, "_blank", "noreferrer");
                  } else {
                    router.push(action.href);
                  }
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-zinc-900"
              >
                <span>{action.label}</span>
                {action.hint && (
                  <span className="font-mono text-[10px] text-zinc-500">
                    {action.hint}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
