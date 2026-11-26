"use client";

import { X } from "lucide-react";
import * as React from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastInput {
  title: string;
  description?: string | undefined;
  variant?: ToastVariant;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  pushToast: (toast: ToastInput) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  pushToast: () => {},
});

export function useUiToast(): ToastContextValue {
  return React.useContext(ToastContext);
}

export function UiToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const pushToast = React.useCallback((toast: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-2 rounded-xl border p-3 shadow-lg backdrop-blur ${
              toast.variant === "error"
                ? "border-rose-500/40 bg-rose-950/90 text-rose-100"
                : toast.variant === "success"
                  ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-100"
                  : "border-zinc-700 bg-zinc-900/95 text-zinc-100"
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-[11px] opacity-85">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((item) => item.id !== toast.id))
              }
              aria-label="Cerrar notificacion"
              className="rounded p-0.5 opacity-70 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
