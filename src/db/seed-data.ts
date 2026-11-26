import type { FlowEdge, FlowNode } from "@/contracts/workflow";

export interface SeedWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  isDemo: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const SEED_WORKFLOWS: SeedWorkflowTemplate[] = [
  {
    id: "wf-ecommerce-order-alert",
    name: "E-Commerce Order Alert",
    description:
      "Evalua pedidos entrantes: si el total supera $100 genera un resumen IA VIP y envia alerta prioritaria; si no, registra notificacion estandar.",
    isDemo: true,
    nodes: [
      {
        id: "trigger-1",
        type: "flowNode",
        position: { x: 60, y: 170 },
        data: {
          nodeType: "trigger",
          label: "Webhook Pedido",
          payload: {
            order: {
              id: "ORD-9482",
              total: 249.5,
              currency: "USD",
              items: 3,
            },
            customer: {
              name: "Elena Vance",
              email: "elena@acme.dev",
              tier: "VIP",
            },
          },
        },
      },
      {
        id: "cond-1",
        type: "flowNode",
        position: { x: 350, y: 170 },
        data: {
          nodeType: "condition",
          label: "Total > $100",
          fieldPath: "input.order.total",
          operator: ">",
          value: "100",
        },
      },
      {
        id: "ai-1",
        type: "flowNode",
        position: { x: 660, y: 70 },
        data: {
          nodeType: "ai_summary",
          label: "Resumen IA VIP",
          prompt:
            "Resume el pedido de alto valor y clasifica prioridad operativa.",
        },
      },
      {
        id: "log-vip-1",
        type: "flowNode",
        position: { x: 960, y: 70 },
        data: {
          nodeType: "log_notify",
          label: "Alerta Canal VIP",
          channel: "ops-vip",
          messageTemplate:
            "VIP {{input.order.id}} ({{input.classification}}): {{input.summary}}",
        },
      },
      {
        id: "log-low-1",
        type: "flowNode",
        position: { x: 660, y: 290 },
        data: {
          nodeType: "log_notify",
          label: "Log Pedido Estandar",
          channel: "ops-standard",
          messageTemplate:
            "Pedido estandar {{input.order.id}} de {{input.customer.email}} ($ {{input.order.total}})",
        },
      },
    ],
    edges: [
      { id: "e-trigger-cond", source: "trigger-1", target: "cond-1" },
      {
        id: "e-cond-true-ai",
        source: "cond-1",
        target: "ai-1",
        sourceHandle: "true",
        label: "true",
      },
      { id: "e-ai-log-vip", source: "ai-1", target: "log-vip-1" },
      {
        id: "e-cond-false-log",
        source: "cond-1",
        target: "log-low-1",
        sourceHandle: "false",
        label: "false",
      },
    ],
  },
  {
    id: "wf-lead-enrichment",
    name: "Lead Enrichment Pipeline",
    description:
      "Normaliza leads B2B entrantes mediante proyeccion JSON, evalua fit comercial con IA y publica alerta estructurada.",
    isDemo: true,
    nodes: [
      {
        id: "trigger-2",
        type: "flowNode",
        position: { x: 60, y: 170 },
        data: {
          nodeType: "trigger",
          label: "Nuevo Lead",
          payload: {
            lead: {
              name: "Mateo Silva",
              email: "mateo@novacloud.io",
              company: "NovaCloud",
              employees: 85,
            },
          },
        },
      },
      {
        id: "transform-2",
        type: "flowNode",
        position: { x: 350, y: 170 },
        data: {
          nodeType: "transform",
          label: "Proyectar Perfil",
          template: {
            contactName: "{{input.lead.name}}",
            contactEmail: "{{input.lead.email}}",
            organization: "{{input.lead.company}}",
            segment: "B2B-Growth",
          },
        },
      },
      {
        id: "ai-2",
        type: "flowNode",
        position: { x: 650, y: 170 },
        data: {
          nodeType: "ai_summary",
          label: "Scoring IA",
          prompt:
            "Clasifica potencial del lead y sugiere siguiente paso comercial.",
        },
      },
      {
        id: "log-2",
        type: "flowNode",
        position: { x: 950, y: 170 },
        data: {
          nodeType: "log_notify",
          label: "Publicar CRM Log",
          channel: "crm-enrichment",
          messageTemplate:
            "Lead listo: {{input.classification}} — {{input.summary}}",
        },
      },
    ],
    edges: [
      { id: "e-t2-tr2", source: "trigger-2", target: "transform-2" },
      { id: "e-tr2-ai2", source: "transform-2", target: "ai-2" },
      { id: "e-ai2-log2", source: "ai-2", target: "log-2" },
    ],
  },
  {
    id: "wf-parallel-fanout",
    name: "Parallel Fan-Out Pipeline",
    description:
      "Demuestra niveles topologicos Kahn paralelos: ramifica en paralelo hacia enriquecimiento y auditoria antes de consolidar.",
    isDemo: true,
    nodes: [
      {
        id: "trigger-3",
        type: "flowNode",
        position: { x: 60, y: 170 },
        data: {
          nodeType: "trigger",
          label: "Evento Checkout",
          payload: {
            order: { id: "CHK-501", total: 180 },
            customer: { email: "ops@flowforge.dev", tier: "PRO" },
          },
        },
      },
      {
        id: "transform-3a",
        type: "flowNode",
        position: { x: 360, y: 80 },
        data: {
          nodeType: "transform",
          label: "Proyectar Factura",
          template: {
            invoiceRef: "INV-{{input.order.id}}",
            billedTo: "{{input.customer.email}}",
          },
        },
      },
      {
        id: "ai-3b",
        type: "flowNode",
        position: { x: 360, y: 260 },
        data: {
          nodeType: "ai_summary",
          label: "Riesgo IA Paralelo",
          prompt: "Evalua riesgo antifraude del checkout.",
        },
      },
      {
        id: "log-3",
        type: "flowNode",
        position: { x: 680, y: 170 },
        data: {
          nodeType: "log_notify",
          label: "Consolidar Nivel 3",
          channel: "checkout-audit",
          messageTemplate:
            "Consolidado {{input.invoiceRef}} -> {{input.classification}}",
        },
      },
    ],
    edges: [
      { id: "e-t3-a", source: "trigger-3", target: "transform-3a" },
      { id: "e-t3-b", source: "trigger-3", target: "ai-3b" },
      { id: "e-a-log3", source: "transform-3a", target: "log-3" },
      { id: "e-b-log3", source: "ai-3b", target: "log-3" },
    ],
  },
];
