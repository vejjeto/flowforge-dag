"use client";

import * as React from "react";

export type Locale = "es" | "en";

export const LOCALE_STORAGE_KEY = "flowforge-lang";
export const LOCALE_CHANGE_EVENT = "flowforge-lang-change";

const es = {
  nodePalette: "Paleta de Nodos",
  dragOrClickToAdd: "Arrastra o haz clic para añadir",
  triggerPayloadLabel: "Payload Trigger (JSON)",
  dagCycleDetected: "Ciclo DAG detectado:",
  conflictingNodes: "nodos en conflicto",
  removeCycleEdges: "Eliminar aristas de ciclo",
  selectWorkflowAria: "Seleccionar plantilla de workflow",
  undo: "Deshacer",
  redo: "Rehacer",
  autoLayout: "Auto-Layout",
  autoLayoutTitle: "Auto-Layout Topologico",
  validateDag: "Validar DAG",
  simulateCycle: "Simular Ciclo (Test Validador)",
  save: "Guardar",
  runDemo: "Ejecutar Flujo (1-Click Demo)",
  mcpInspector: "MCP Inspector",
  mcpInspectorTitle: "Abrir MCP Inspector",
  workflows: "Workflows",
  toggleThemeAria: "Alternar tema",
  executionLogs: "Logs de Ejecucion:",
  backToStudio: "Volver al Studio",
  workflowsPageTitle: "Workflows e Historial de Ejecuciones",
  createNewWorkflow: "Crear nuevo workflow",
  workflowNamePlaceholder: "Nombre del flujo...",
  workflowDescPlaceholder: "Descripcion breve...",
  createWorkflowBtn: "Crear Workflow",
  nodesLabel: "nodos",
  edgesLabel: "aristas",
  openInStudio: "Abrir en Studio",
  deleteWorkflow: "Eliminar workflow",
  executionHistory: "Historial de Ejecuciones",
  noRunsYet:
    "Aun no hay ejecuciones registradas para este workflow. Ejecutalo desde el Studio.",
  replayFromNode: "Re-ejecutar desde este nodo",
} as const;

export type TranslationKey = keyof typeof es;

const en: Record<TranslationKey, string> = {
  nodePalette: "Node Palette",
  dragOrClickToAdd: "Drag or click to add",
  triggerPayloadLabel: "Trigger Payload (JSON)",
  dagCycleDetected: "DAG cycle detected:",
  conflictingNodes: "conflicting nodes",
  removeCycleEdges: "Remove cycle edges",
  selectWorkflowAria: "Select workflow template",
  undo: "Undo",
  redo: "Redo",
  autoLayout: "Auto-Layout",
  autoLayoutTitle: "Topological Auto-Layout",
  validateDag: "Validate DAG",
  simulateCycle: "Simulate Cycle (Test Validator)",
  save: "Save",
  runDemo: "Run Flow (1-Click Demo)",
  mcpInspector: "MCP Inspector",
  mcpInspectorTitle: "Open MCP Inspector",
  workflows: "Workflows",
  toggleThemeAria: "Toggle theme",
  executionLogs: "Execution Logs:",
  backToStudio: "Back to Studio",
  workflowsPageTitle: "Workflows & Execution History",
  createNewWorkflow: "Create new workflow",
  workflowNamePlaceholder: "Workflow name...",
  workflowDescPlaceholder: "Short description...",
  createWorkflowBtn: "Create Workflow",
  nodesLabel: "nodes",
  edgesLabel: "edges",
  openInStudio: "Open in Studio",
  deleteWorkflow: "Delete workflow",
  executionHistory: "Execution History",
  noRunsYet: "No runs recorded for this workflow yet. Run it from Studio.",
  replayFromNode: "Replay from this node",
};

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  es,
  en,
};

function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}

export function useLocale() {
  const [locale, setLocaleState] = React.useState<Locale>("es");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(saved)) {
        setLocaleState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      // Ignore storage errors
    }

    const handleChange = (event: Event) => {
      const custom = event as CustomEvent<Locale>;
      if (isLocale(custom.detail)) {
        setLocaleState(custom.detail);
      }
    };

    window.addEventListener(LOCALE_CHANGE_EVENT, handleChange);
    return () => {
      window.removeEventListener(LOCALE_CHANGE_EVENT, handleChange);
    };
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<Locale>(LOCALE_CHANGE_EVENT, { detail: next }),
      );
    }
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === "es" ? "en" : "es");
  }, [locale, setLocale]);

  return {
    locale,
    setLocale,
    toggleLocale,
    t: translations[locale],
  };
}
