import {
  getRequestId,
  jsonWithRequestId,
  problemDetailsResponse,
} from "@/lib/problem-details";
import { handleJsonRpcRequest } from "@/mcp/tools";

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return problemDetailsResponse({
      status: 400,
      title: "Invalid JSON body",
      detail: "Request body must be valid JSON-RPC 2.0",
      requestId,
    });
  }

  const rpcResponse = await handleJsonRpcRequest(rawBody);
  return jsonWithRequestId(rpcResponse, { status: 200, requestId });
}
