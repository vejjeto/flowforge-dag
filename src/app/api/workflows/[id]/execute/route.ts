import { ExecuteWorkflowRequestSchema } from "@/contracts/workflow";
import {
  type ExecutionStreamEvent,
  executeWorkflowGraph,
} from "@/core/graph/executor";
import { getWorkflowById, saveWorkflowRun } from "@/db/repository";
import { createRequestLogger } from "@/lib/logger";
import {
  getRequestId,
  jsonWithRequestId,
  problemDetailsResponse,
} from "@/lib/problem-details";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function wantsSseStream(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const url = new URL(request.url);
  return (
    accept.includes("text/event-stream") ||
    url.searchParams.get("stream") === "1"
  );
}

function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = getRequestId(request);
  const log = createRequestLogger(requestId);
  const { id } = await context.params;
  const workflow = await getWorkflowById(id);

  let rawBody: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) rawBody = JSON.parse(text);
  } catch {
    return problemDetailsResponse({
      status: 400,
      title: "Invalid JSON body",
      detail: "Request body could not be parsed as JSON",
      requestId,
    });
  }

  const parsed = ExecuteWorkflowRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return problemDetailsResponse({
      status: 400,
      title: "Validation error",
      detail: "Execute payload failed schema validation",
      errors: parsed.error.flatten(),
      requestId,
    });
  }

  const nodes = parsed.data.nodes ?? workflow?.nodes;
  const edges = parsed.data.edges ?? workflow?.edges;
  if (!workflow || !nodes || !edges) {
    return problemDetailsResponse({
      status: 404,
      title: "Workflow not found",
      detail: `No workflow found with id "${id}"`,
      requestId,
    });
  }

  const triggerPayload = parsed.data.triggerPayload ?? {};
  const startedAt = new Date().toISOString();

  if (!wantsSseStream(request)) {
    const result = await executeWorkflowGraph({ nodes, edges, triggerPayload });
    const finishedAt = new Date().toISOString();
    const run = await saveWorkflowRun({
      workflowId: workflow.id,
      status: result.status,
      triggerPayload,
      totalDurationMs: result.totalDurationMs,
      startedAt,
      finishedAt,
      nodeLogs: result.nodeLogs,
    });
    log.info(
      { workflowId: workflow.id, runId: run.id, status: result.status },
      "Workflow executed",
    );
    return jsonWithRequestId(
      { run, validation: result.validation, nodeLogs: result.nodeLogs },
      { status: 200, requestId },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(formatSseEvent(event, data)));
      };

      send("run:start", { workflowId: workflow.id, startedAt });
      const result = await executeWorkflowGraph({
        nodes,
        edges,
        triggerPayload,
        onEvent: (ev: ExecutionStreamEvent) => {
          send(ev.type, ev);
        },
      });
      const finishedAt = new Date().toISOString();
      const run = await saveWorkflowRun({
        workflowId: workflow.id,
        status: result.status,
        triggerPayload,
        totalDurationMs: result.totalDurationMs,
        startedAt,
        finishedAt,
        nodeLogs: result.nodeLogs,
      });
      log.info(
        { workflowId: workflow.id, runId: run.id, status: result.status },
        "Workflow streamed",
      );
      send("run:complete", {
        run,
        validation: result.validation,
        nodeLogs: result.nodeLogs,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-request-id": requestId,
    },
  });
}
