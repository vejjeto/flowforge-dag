import { ValidateDagRequestSchema } from "@/contracts/workflow";
import { computeTopologicalLevels, validateDag } from "@/core/graph/dag";
import { getWorkflowById } from "@/db/repository";
import {
  getRequestId,
  jsonWithRequestId,
  problemDetailsResponse,
} from "@/lib/problem-details";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = getRequestId(request);
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

  const parsed = ValidateDagRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return problemDetailsResponse({
      status: 400,
      title: "Validation error",
      detail: "Validation request payload is invalid",
      errors: parsed.error.flatten(),
      requestId,
    });
  }

  const nodes = parsed.data.nodes ?? workflow?.nodes;
  const edges = parsed.data.edges ?? workflow?.edges;
  if (!nodes || !edges) {
    return problemDetailsResponse({
      status: 404,
      title: "Workflow not found",
      detail: `No workflow found with id "${id}"`,
      requestId,
    });
  }

  const result = validateDag(nodes, edges);
  const levels = result.valid ? computeTopologicalLevels(nodes, edges) : [];
  return jsonWithRequestId({ ...result, levels }, { status: 200, requestId });
}
