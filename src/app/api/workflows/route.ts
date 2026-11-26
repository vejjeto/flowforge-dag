import { WorkflowCreateSchema } from "@/contracts/workflow";
import { createWorkflow, listWorkflows } from "@/db/repository";
import {
  getRequestId,
  jsonWithRequestId,
  problemDetailsResponse,
} from "@/lib/problem-details";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  const workflows = await listWorkflows();
  return jsonWithRequestId({ workflows }, { status: 200, requestId });
}

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
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

  const parsed = WorkflowCreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return problemDetailsResponse({
      status: 400,
      title: "Validation error",
      detail: "Workflow payload failed schema validation",
      errors: parsed.error.flatten(),
      requestId,
    });
  }

  const workflow = await createWorkflow(parsed.data);
  return jsonWithRequestId({ workflow }, { status: 201, requestId });
}
