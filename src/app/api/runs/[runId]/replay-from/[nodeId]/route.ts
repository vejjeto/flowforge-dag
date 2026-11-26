import { replayFromNode } from "@/core/graph/executor";
import {
  getWorkflowById,
  getWorkflowRunById,
  saveWorkflowRun,
} from "@/db/repository";
import { createRequestLogger } from "@/lib/logger";
import {
  getRequestId,
  jsonWithRequestId,
  problemDetailsResponse,
} from "@/lib/problem-details";

interface RouteContext {
  params: Promise<{ runId: string; nodeId: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = getRequestId(request);
  const log = createRequestLogger(requestId);
  const { runId, nodeId } = await context.params;

  const previousRun = await getWorkflowRunById(runId);
  if (!previousRun) {
    return problemDetailsResponse({
      status: 404,
      title: "Run not found",
      detail: `No workflow run found with id "${runId}"`,
      requestId,
    });
  }

  const workflow = await getWorkflowById(previousRun.workflowId);
  if (!workflow) {
    return problemDetailsResponse({
      status: 404,
      title: "Workflow not found",
      detail: `Parent workflow "${previousRun.workflowId}" not found`,
      requestId,
    });
  }

  const targetExists = workflow.nodes.some((n) => n.id === nodeId);
  if (!targetExists) {
    return problemDetailsResponse({
      status: 404,
      title: "Target node not found",
      detail: `Node "${nodeId}" does not exist in workflow "${workflow.id}"`,
      requestId,
    });
  }

  const startedAt = new Date().toISOString();
  const result = await replayFromNode({
    nodes: workflow.nodes,
    edges: workflow.edges,
    targetNodeId: nodeId,
    previousLogs: previousRun.nodeLogs ?? [],
    triggerPayload: previousRun.triggerPayload,
  });
  const finishedAt = new Date().toISOString();

  const run = await saveWorkflowRun({
    workflowId: workflow.id,
    status: result.status,
    triggerPayload: previousRun.triggerPayload,
    totalDurationMs: result.totalDurationMs,
    startedAt,
    finishedAt,
    nodeLogs: result.nodeLogs,
  });

  log.info(
    {
      previousRunId: runId,
      newRunId: run.id,
      targetNodeId: nodeId,
      status: run.status,
    },
    "Replayed workflow from checkpoint",
  );

  return jsonWithRequestId(
    {
      run,
      replayedFromNodeId: nodeId,
      validation: result.validation,
      nodeLogs: result.nodeLogs,
    },
    { status: 200, requestId },
  );
}
