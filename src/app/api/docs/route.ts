import { getFlowForgeOpenApiSpec, renderOpenApiDocsHtml } from "@/lib/openapi";
import { getRequestId } from "@/lib/problem-details";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  const spec = getFlowForgeOpenApiSpec();
  const html = renderOpenApiDocsHtml({
    title: "FlowForge API",
    specUrl: "/api/openapi.json",
    spec,
  });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}
