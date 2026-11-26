import { FlowEdgeSchema, FlowNodeSchema } from "@/contracts/workflow";
import { computeTopologicalLevels, validateDag } from "@/core/graph/dag";
import { executeWorkflowGraph } from "@/core/graph/executor";
import {
  getWorkflowById,
  getWorkflowRunById,
  listWorkflowRuns,
  listWorkflows,
  saveWorkflowRun,
} from "@/db/repository";
import { z } from "zod";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "list_workflows",
    description:
      "List all saved FlowForge DAG workflows with node and edge counts.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "validate_dag",
    description:
      "Validate a workflow DAG by workflowId or inline nodes/edges using Kahn topological levels.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: {
          type: "string",
          description: "Existing workflow ID to validate",
        },
        nodes: {
          type: "array",
          description: "Optional inline FlowNode[] override",
        },
        edges: {
          type: "array",
          description: "Optional inline FlowEdge[] override",
        },
      },
    },
  },
  {
    name: "run_workflow",
    description:
      "Execute a saved workflow DAG in parallel topological levels and persist run logs.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Workflow ID to execute" },
        triggerPayload: {
          type: "object",
          description: "Optional trigger JSON payload",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "get_run_logs",
    description:
      "Retrieve execution checkpoints (inputJson, outputJson, status) by runId or workflowId.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Specific workflow run ID" },
        workflowId: {
          type: "string",
          description: "Workflow ID to list recent runs",
        },
        limit: {
          type: "number",
          description: "Max runs to return (default 5)",
        },
      },
    },
  },
];

const ValidateInputSchema = z.object({
  workflowId: z.string().min(1).optional(),
  nodes: z.array(FlowNodeSchema).optional(),
  edges: z.array(FlowEdgeSchema).optional(),
});

const RunWorkflowInputSchema = z.object({
  workflowId: z.string().min(1),
  triggerPayload: z.record(z.string(), z.unknown()).optional(),
});

const GetRunLogsInputSchema = z.object({
  runId: z.string().min(1).optional(),
  workflowId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

export async function callMcpTool(
  name: string,
  rawArgs: unknown = {},
): Promise<Record<string, unknown>> {
  switch (name) {
    case "list_workflows": {
      const workflows = await listWorkflows();
      return {
        workflows: workflows.map((wf) => ({
          id: wf.id,
          name: wf.name,
          description: wf.description,
          isDemo: wf.isDemo,
          nodeCount: wf.nodes.length,
          edgeCount: wf.edges.length,
          updatedAt: wf.updatedAt,
        })),
      };
    }

    case "validate_dag": {
      const args = ValidateInputSchema.parse(rawArgs ?? {});
      const wf = args.workflowId
        ? await getWorkflowById(args.workflowId)
        : null;
      if (args.workflowId && !wf && (!args.nodes || !args.edges)) {
        throw new Error(`Workflow "${args.workflowId}" not found`);
      }
      const nodes = args.nodes ?? wf?.nodes;
      const edges = args.edges ?? wf?.edges;
      if (!nodes || !edges) {
        throw new Error("Provide either workflowId or both nodes and edges");
      }
      const validation = validateDag(nodes, edges);
      const levels = validation.valid
        ? computeTopologicalLevels(nodes, edges)
        : [];
      return { ...validation, levels };
    }

    case "run_workflow": {
      const args = RunWorkflowInputSchema.parse(rawArgs ?? {});
      const wf = await getWorkflowById(args.workflowId);
      if (!wf) {
        throw new Error(`Workflow "${args.workflowId}" not found`);
      }
      const triggerPayload = args.triggerPayload ?? {};
      const startedAt = new Date().toISOString();
      const result = await executeWorkflowGraph({
        nodes: wf.nodes,
        edges: wf.edges,
        triggerPayload,
      });
      const finishedAt = new Date().toISOString();
      const run = await saveWorkflowRun({
        workflowId: wf.id,
        status: result.status,
        triggerPayload,
        totalDurationMs: result.totalDurationMs,
        startedAt,
        finishedAt,
        nodeLogs: result.nodeLogs,
      });
      return { run, validation: result.validation, nodeLogs: result.nodeLogs };
    }

    case "get_run_logs": {
      const args = GetRunLogsInputSchema.parse(rawArgs ?? {});
      if (args.runId) {
        const run = await getWorkflowRunById(args.runId);
        if (!run) throw new Error(`Run "${args.runId}" not found`);
        return { run };
      }
      if (args.workflowId) {
        const runs = await listWorkflowRuns(args.workflowId, args.limit ?? 5);
        return { runs };
      }
      throw new Error("Provide either runId or workflowId");
    }

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Handles a single JSON-RPC 2.0 MCP request (used by both HTTP /api/mcp and stdio server).
 */
export async function handleJsonRpcRequest(
  rawPayload: unknown,
): Promise<JsonRpcResponse> {
  const parsed = JsonRpcRequestSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid JSON-RPC 2.0 request" },
    };
  }

  const { id = null, method, params } = parsed.data;

  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "flowforge-dag-mcp", version: "2.0.0" },
        },
      };
    }

    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: MCP_TOOL_DEFINITIONS } };
    }

    if (method === "tools/call") {
      const toolName = typeof params?.name === "string" ? params.name : "";
      const toolArgs = params?.arguments ?? {};
      const toolResult = await callMcpTool(toolName, toolArgs);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            { type: "text", text: JSON.stringify(toolResult, null, 2) },
          ],
          structuredContent: toolResult,
        },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32602,
        message:
          err instanceof Error ? err.message : "MCP tool execution error",
      },
    };
  }
}
