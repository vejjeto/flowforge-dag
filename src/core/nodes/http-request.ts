import type { HttpRequestNodeDataSchema } from "@/contracts/workflow";
import { validateSafeExternalUrl } from "@/lib/ssrf";
import type { z } from "zod";
import { interpolateValue } from "./path-utils";

type HttpData = z.infer<typeof HttpRequestNodeDataSchema>;

function resolvePayloadBody(
  data: HttpData,
  input: Record<string, unknown>,
): string | undefined {
  if (data.method === "GET") return undefined;
  const sourceBody =
    data.body && Object.keys(data.body).length > 0 ? data.body : input;
  return JSON.stringify(interpolateValue(sourceBody, input));
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.slice(0, 1000);
  }
}

/**
 * Executes an outbound HTTP GET/POST request protected by SSRF validation and a 5s timeout.
 */
export async function executeHttpRequestNode(
  data: HttpData,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const targetUrl = String(interpolateValue(data.url, input));
  const validation = await validateSafeExternalUrl(targetUrl);

  if (!validation.allowed || !validation.normalizedUrl) {
    throw new Error(
      validation.reason ?? `SSRF guard rejected URL: ${targetUrl}`,
    );
  }

  const bodyText = resolvePayloadBody(data, input);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(data.headers ?? {}),
  };

  const response = await fetch(validation.normalizedUrl, {
    method: data.method,
    headers,
    ...(bodyText !== undefined ? { body: bodyText } : {}),
    signal: AbortSignal.timeout(5000),
  });
  const parsedBody = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${validation.normalizedUrl}`);
  }
  return {
    status: response.status,
    ok: true,
    targetUrl: validation.normalizedUrl,
    response: parsedBody,
    payloadSent: bodyText ? (JSON.parse(bodyText) as unknown) : null,
  };
}
