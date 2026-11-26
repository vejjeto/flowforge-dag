import {
  ExecuteWorkflowRequestSchema,
  ValidateDagRequestSchema,
  WorkflowCreateSchema,
  WorkflowUpdateSchema,
} from "@/contracts/workflow";

/**
 * Generates the OpenAPI 3.1.0 specification for FlowForge API routes.
 */
export function getFlowForgeOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "FlowForge — Visual DAG Automation API",
      version: "2.0.0",
      description:
        "REST, SSE & MCP API for managing visual automation DAGs, parallel Kahn topological levels, checkpoint replay, and sandboxed node execution.",
    },
    servers: [{ url: "http://localhost:3006" }],
    paths: {
      "/api/workflows": {
        get: {
          tags: ["Workflows"],
          summary: "List all saved automation workflows",
          responses: {
            "200": { description: "Array of workflow definitions" },
          },
        },
        post: {
          tags: ["Workflows"],
          summary: "Create a new automation workflow",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  description:
                    WorkflowCreateSchema.description ?? "WorkflowCreateSchema",
                },
              },
            },
          },
          responses: { "201": { description: "Created workflow definition" } },
        },
      },
      "/api/workflows/{id}": {
        get: {
          tags: ["Workflows"],
          summary: "Get a workflow and its recent execution runs",
          responses: {
            "200": { description: "Workflow details and run history" },
          },
        },
        put: {
          tags: ["Workflows"],
          summary: "Update a workflow graph and metadata",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  description:
                    WorkflowUpdateSchema.description ?? "WorkflowUpdateSchema",
                },
              },
            },
          },
          responses: { "200": { description: "Updated workflow definition" } },
        },
        delete: {
          tags: ["Workflows"],
          summary: "Delete a workflow and cascade its runs",
          responses: { "200": { description: "Deletion confirmation" } },
        },
      },
      "/api/workflows/{id}/validate": {
        post: {
          tags: ["DAG Engine"],
          summary:
            "Validate workflow DAG using Kahn topological sort and cycle detection",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  description:
                    ValidateDagRequestSchema.description ??
                    "ValidateDagRequestSchema",
                },
              },
            },
          },
          responses: {
            "200": { description: "Validation result with levels & cycles" },
          },
        },
      },
      "/api/workflows/{id}/execute": {
        post: {
          tags: ["DAG Engine"],
          summary:
            "Execute workflow DAG (supports JSON or SSE via Accept: text/event-stream)",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  description:
                    ExecuteWorkflowRequestSchema.description ??
                    "ExecuteWorkflowRequestSchema",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Execution summary and per-node checkpoint logs",
            },
          },
        },
      },
      "/api/runs/{runId}/replay-from/{nodeId}": {
        post: {
          tags: ["DAG Engine"],
          summary:
            "Replay a workflow run from a specific/failed node reusing upstream checkpoints",
          responses: {
            "200": {
              description: "Replayed run summary and updated node logs",
            },
          },
        },
      },
      "/api/mcp": {
        post: {
          tags: ["MCP"],
          summary: "JSON-RPC 2.0 Model Context Protocol endpoint",
          responses: { "200": { description: "JSON-RPC 2.0 response" } },
        },
      },
      "/api/health": {
        get: {
          tags: ["Observability"],
          summary: "Service and SQLite health check",
          responses: {
            "200": { description: "Health status with DB latency" },
          },
        },
      },
    },
  };
}

export function renderOpenApiDocsHtml(params: {
  title: string;
  specUrl: string;
  spec: Record<string, unknown>;
}): string {
  const jsonSpec = JSON.stringify(params.spec, null, 2);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.title}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #f4f4f5; margin: 0; padding: 2rem; }
    .wrap { max-width: 960px; margin: 0 auto; }
    a { color: #818cf8; }
    pre { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 1.25rem; overflow: auto; font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${params.title}</h1>
    <p>OpenAPI JSON: <a href="${params.specUrl}">${params.specUrl}</a></p>
    <pre>${jsonSpec.replace(/</g, "&lt;")}</pre>
  </div>
</body>
</html>`;
}
