import { getFlowForgeOpenApiSpec } from "@/lib/openapi";
import { getRequestId, jsonWithRequestId } from "@/lib/problem-details";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  return jsonWithRequestId(getFlowForgeOpenApiSpec(), {
    status: 200,
    requestId,
  });
}
