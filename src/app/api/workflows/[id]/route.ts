import { WorkflowUpdateSchema } from "@/contracts/workflow";
import {
  deleteWorkflow,
  getWorkflowById,
  listWorkflowRuns,
  updateWorkflow,
} from "@/db/repository";
import {
  getRequestId,
  jsonWithRequestId,
  problemDetailsResponse,
} from "@/lib/problem-details";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const workflow = await getWorkflowById(id);
  if (!workflow) {
    return problemDetailsResponse({
      status: 404,
      title: "Workflow not found",
      detail: `No workflow found with id "${id}"`,
      requestId,
    });
  }
  const runs = await listWorkflowRuns(id, 10);
  return jsonWithRequestId({ workflow, runs }, { status: 200, requestId });
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return problemDetailsResponse({
      status: 400,
      title: "Invalid JSON body",
      detail: "Request body could not be parsed as JSON",
      requestId,
    });
  }

  const parsed = WorkflowUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return problemDetailsResponse({
      status: 400,
      title: "Validation error",
      detail: "Workflow update payload failed schema validation",
      errors: parsed.error.flatten(),
      requestId,
    });
  }

  const updated = await updateWorkflow(id, parsed.data);
  if (!updated) {
    return problemDetailsResponse({
      status: 404,
      title: "Workflow not found",
      detail: `No workflow found with id "${id}"`,
      requestId,
    });
  }
  return jsonWithRequestId({ workflow: updated }, { status: 200, requestId });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const deleted = await deleteWorkflow(id);
  if (!deleted) {
    return problemDetailsResponse({
      status: 404,
      title: "Workflow not found",
      detail: `No workflow found with id "${id}"`,
      requestId,
    });
  }
  return jsonWithRequestId({ deleted: true, id }, { status: 200, requestId });
}
