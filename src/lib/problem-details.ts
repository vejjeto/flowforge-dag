import { randomUUID } from "node:crypto";

export interface ProblemDetailsOptions {
  status: number;
  title: string;
  detail?: string;
  type?: string;
  instance?: string;
  requestId?: string;
  errors?: unknown;
}

export function getRequestId(request?: Request): string {
  const incoming = request?.headers.get("x-request-id")?.trim();
  return incoming && incoming.length > 0 ? incoming : randomUUID();
}

export function jsonWithRequestId(
  data: unknown,
  init: ResponseInit & { requestId?: string } = {},
): Response {
  const { requestId = randomUUID(), headers, ...rest } = init;
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set("x-request-id", requestId);
  mergedHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    ...rest,
    headers: mergedHeaders,
  });
}

/**
 * Returns an RFC 7807 application/problem+json response with x-request-id.
 */
export function problemDetailsResponse(
  options: ProblemDetailsOptions,
): Response {
  const requestId = options.requestId ?? randomUUID();
  const body: Record<string, unknown> = {
    type: options.type ?? `https://httpstatuses.com/${options.status}`,
    title: options.title,
    status: options.status,
    requestId,
  };
  if (options.detail !== undefined) body.detail = options.detail;
  if (options.instance !== undefined) body.instance = options.instance;
  if (options.errors !== undefined) body.errors = options.errors;

  return new Response(JSON.stringify(body), {
    status: options.status,
    headers: {
      "Content-Type": "application/problem+json; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}
