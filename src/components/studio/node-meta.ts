import type { FlowNodeData, FlowNodeType } from "@/contracts/workflow";

export interface NodeTypeMeta {
  type: FlowNodeType;
  title: string;
  shortTag: string;
  description: string;
  badgeClass: string;
  borderClass: string;
  accentHex: string;
  createDefaultData: () => FlowNodeData;
}

export const NODE_TYPE_META: Record<FlowNodeType, NodeTypeMeta> = {
  trigger: {
    type: "trigger",
    title: "Trigger",
    shortTag: "EVENT",
    description: "Webhook o payload JSON inicial",
    badgeClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    borderClass: "border-indigo-500/50",
    accentHex: "#6366f1",
    createDefaultData: () => ({
      nodeType: "trigger",
      label: "Webhook Trigger",
      payload: { event: "manual.test", order: { id: "ORD-101", total: 150 } },
    }),
  },
  condition: {
    type: "condition",
    title: "Condition",
    shortTag: "IF/ELSE",
    description: "Regla AST segura sin eval()",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    borderClass: "border-amber-500/50",
    accentHex: "#f59e0b",
    createDefaultData: () => ({
      nodeType: "condition",
      label: "Evaluar Regla",
      fieldPath: "input.order.total",
      operator: ">",
      value: "100",
    }),
  },
  transform: {
    type: "transform",
    title: "Transform",
    shortTag: "JSON",
    description: "Interpolación {{dot.path}}",
    badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    borderClass: "border-cyan-500/50",
    accentHex: "#06b6d4",
    createDefaultData: () => ({
      nodeType: "transform",
      label: "Transformar JSON",
      template: {
        orderId: "{{input.order.id}}",
        total: "{{input.order.total}}",
      },
    }),
  },
  http: {
    type: "http",
    title: "HTTP Request",
    shortTag: "FETCH",
    description: "GET/POST con guard anti-SSRF",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    borderClass: "border-emerald-500/50",
    accentHex: "#10b981",
    createDefaultData: () => ({
      nodeType: "http",
      label: "HTTP Request",
      method: "POST",
      url: "https://httpbin.org/post",
    }),
  },
  ai_summary: {
    type: "ai_summary",
    title: "AI Summary",
    shortTag: "AI",
    description: "Resumen IA o Demo AI local",
    badgeClass: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    borderClass: "border-violet-500/50",
    accentHex: "#8b5cf6",
    createDefaultData: () => ({
      nodeType: "ai_summary",
      label: "Resumen IA",
      prompt: "Resume el evento entrante y clasifica su prioridad.",
    }),
  },
  log_notify: {
    type: "log_notify",
    title: "Log & Notify",
    shortTag: "LOG",
    description: "Salida estructurada y alerta",
    badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    borderClass: "border-rose-500/50",
    accentHex: "#f43f5e",
    createDefaultData: () => ({
      nodeType: "log_notify",
      label: "Notificar Canal",
      channel: "ops-alerts",
      messageTemplate: "Evento procesado: {{input.order.id}}",
    }),
  },
};

export const NODE_TYPE_LIST: NodeTypeMeta[] = Object.values(NODE_TYPE_META);
