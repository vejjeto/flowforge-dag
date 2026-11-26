import { checkDbHealth, getDb } from "@/db";
import {
  getRequestId,
  jsonWithRequestId,
  problemDetailsResponse,
} from "@/lib/problem-details";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  const start = performance.now();

  try {
    await getDb();
    checkDbHealth();
    const latencyMs = Math.max(1, Math.round(performance.now() - start));

    return jsonWithRequestId(
      {
        status: "ok",
        service: "flowforge-dag",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        db: { ok: true, latencyMs },
        details: {
          engine: "kahn-parallel-dag-v2",
          sqlite: "node:sqlite",
        },
      },
      { status: 200, requestId },
    );
  } catch (err) {
    return problemDetailsResponse({
      status: 503,
      title: "Service Unavailable",
      detail:
        err instanceof Error ? err.message : "Database health check failed",
      requestId,
    });
  }
}
