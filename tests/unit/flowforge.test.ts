import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET as getHealth } from "@/app/api/health/route";
import { POST as postMcp } from "@/app/api/mcp/route";
import { GET as getOpenApi } from "@/app/api/openapi.json/route";
import { POST as replayFromNodeRoute } from "@/app/api/runs/[runId]/replay-from/[nodeId]/route";
import { POST as executeWorkflowRoute } from "@/app/api/workflows/[id]/execute/route";
import { GET as getWorkflowRoute } from "@/app/api/workflows/[id]/route";
import { POST as createWorkflowRoute } from "@/app/api/workflows/route";
import type { FlowEdge, FlowNode } from "@/contracts/workflow";
import {
  computeTopologicalLevels,
  topologicalSortKahn,
  validateDag,
} from "@/core/graph/dag";
import { executeWorkflowGraph, replayFromNode } from "@/core/graph/executor";
import { executeAiSummaryNode } from "@/core/nodes/ai-summary";
import { executeConditionNode } from "@/core/nodes/condition";
import { executeHttpRequestNode } from "@/core/nodes/http-request";
import { executeTransformNode } from "@/core/nodes/transform";
import { getDb, resetDbConnection, seedDatabase } from "@/db";
import { validateEnv } from "@/lib/env";
import { isBlockedIpAddress } from "@/lib/ssrf";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let tempDir = "";

function makeNode(id: string, data: FlowNode["data"]): FlowNode {
  return { id, type: "flowNode", position: { x: 0, y: 0 }, data };
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "flowforge-test-"));
  process.env.FLOWFORGE_DB_PATH = path.join(tempDir, "test.db");
  resetDbConnection();
  const db = await getDb();
  await seedDatabase(db);
});

afterAll(() => {
  resetDbConnection();
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("FlowForge Core DAG, Parallel Levels, Replay & MCP", () => {
  it("detects simple and complex cycles accurately", () => {
    const nodes: FlowNode[] = [
      makeNode("n1", { nodeType: "trigger", label: "Start", payload: {} }),
      makeNode("n2", {
        nodeType: "transform",
        label: "Step A",
        template: { ok: true },
      }),
      makeNode("n3", {
        nodeType: "transform",
        label: "Step B",
        template: { ok: true },
      }),
      makeNode("n4", {
        nodeType: "transform",
        label: "Step C",
        template: { ok: true },
      }),
      makeNode("n5", {
        nodeType: "log_notify",
        label: "Downstream",
        channel: "ops",
        messageTemplate: "done",
      }),
    ];
    const edges: FlowEdge[] = [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
      { id: "e4", source: "n4", target: "n2" },
      { id: "e5", source: "n4", target: "n5" },
    ];

    const result = validateDag(nodes, edges);
    expect(result.valid).toBe(false);
    expect(result.cycleNodes).toEqual(["n2", "n3", "n4"]);
    expect(result.cycleEdges).toEqual(["e2", "e3", "e4"]);

    const selfLoopNodes: FlowNode[] = [
      makeNode("s1", { nodeType: "transform", label: "Self", template: {} }),
    ];
    const selfLoopEdges: FlowEdge[] = [
      { id: "e-self", source: "s1", target: "s1" },
    ];
    const selfRes = validateDag(selfLoopNodes, selfLoopEdges);
    expect(selfRes.valid).toBe(false);
    expect(selfRes.cycleNodes).toEqual(["s1"]);
    expect(selfRes.cycleEdges).toEqual(["e-self"]);
  });

  it("computes parallel topological levels via Kahn O(V + E) and executes levels concurrently", async () => {
    const nodes: FlowNode[] = [
      makeNode("t", {
        nodeType: "trigger",
        label: "T",
        payload: { user: { name: "Ada" } },
      }),
      makeNode("a", {
        nodeType: "transform",
        label: "A",
        template: { tagA: "A-{{input.user.name}}" },
      }),
      makeNode("b", {
        nodeType: "transform",
        label: "B",
        template: { tagB: "B-{{input.user.name}}" },
      }),
      makeNode("c", {
        nodeType: "log_notify",
        label: "C",
        channel: "x",
        messageTemplate: "{{input.tagA}} + {{input.tagB}}",
      }),
    ];
    const edges: FlowEdge[] = [
      { id: "e1", source: "t", target: "a" },
      { id: "e2", source: "t", target: "b" },
      { id: "e3", source: "a", target: "c" },
      { id: "e4", source: "b", target: "c" },
    ];

    expect(computeTopologicalLevels(nodes, edges)).toEqual([
      ["t"],
      ["a", "b"],
      ["c"],
    ]);
    expect(topologicalSortKahn(nodes, edges)).toEqual(["t", "a", "b", "c"]);

    const exec = await executeWorkflowGraph({ nodes, edges });
    expect(exec.status).toBe("success");
    const cLog = exec.nodeLogs.find((l) => l.nodeId === "c");
    expect(cLog?.outputJson.message).toBe("A-Ada + B-Ada");
  });

  it("propagates ConditionNode branches and rejects prototype pollution without eval()", async () => {
    const input = { order: { total: 250 }, tags: ["vip", "express"] };
    expect(
      executeConditionNode(
        {
          nodeType: "condition",
          label: "gt",
          fieldPath: "input.order.total",
          operator: ">",
          value: "100",
        },
        input,
      ).matched,
    ).toBe(true);

    expect(
      executeConditionNode(
        {
          nodeType: "condition",
          label: "proto",
          fieldPath: "__proto__.toString",
          operator: "!=",
          value: "",
        },
        input,
      ).matched,
    ).toBe(false);

    expect(
      executeConditionNode(
        {
          nodeType: "condition",
          label: "constructor",
          fieldPath: "constructor.prototype",
          operator: "!=",
          value: "",
        },
        input,
      ).matched,
    ).toBe(false);

    const nodes: FlowNode[] = [
      makeNode("trig", {
        nodeType: "trigger",
        label: "Trigger",
        payload: { order: { total: 40 } },
      }),
      makeNode("cond", {
        nodeType: "condition",
        label: "Check Total",
        fieldPath: "input.order.total",
        operator: ">",
        value: "100",
      }),
      makeNode("vip", {
        nodeType: "log_notify",
        label: "VIP",
        channel: "vip",
        messageTemplate: "VIP",
      }),
      makeNode("std", {
        nodeType: "log_notify",
        label: "Standard",
        channel: "std",
        messageTemplate: "STD",
      }),
    ];
    const edges: FlowEdge[] = [
      { id: "e1", source: "trig", target: "cond" },
      { id: "e2", source: "cond", target: "vip", sourceHandle: "true" },
      { id: "e3", source: "cond", target: "std", sourceHandle: "false" },
    ];

    const result = await executeWorkflowGraph({ nodes, edges });
    expect(result.nodeLogs.find((l) => l.nodeId === "vip")?.status).toBe(
      "skipped",
    );
    expect(result.nodeLogs.find((l) => l.nodeId === "std")?.status).toBe(
      "success",
    );
  });

  it("interpolates {{dot.path}} templates cleanly in TransformNode", () => {
    const output = executeTransformNode(
      {
        nodeType: "transform",
        label: "Project Customer",
        template: {
          email: "{{input.customer.email}}",
          greeting: "Hola {{input.customer.name}}",
          amount: "{{input.order.total}}",
        },
      },
      {
        customer: { name: "Ada", email: "ada@flowforge.dev" },
        order: { total: 199 },
      },
    );

    expect(output).toEqual({
      email: "ada@flowforge.dev",
      greeting: "Hola Ada",
      amount: "199",
    });
  });

  it("blocks SSRF private/loopback/metadata IPs and URLs in HttpRequestNode", async () => {
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);

    await expect(
      executeHttpRequestNode(
        {
          nodeType: "http",
          label: "Metadata SSRF",
          method: "GET",
          url: "http://169.254.169.254/latest/meta-data/",
        },
        {},
      ),
    ).rejects.toThrow(/SSRF guard/i);

    await expect(
      executeHttpRequestNode(
        {
          nodeType: "http",
          label: "File protocol",
          method: "GET",
          url: "file:///etc/passwd",
        },
        {},
      ),
    ).rejects.toThrow(/Disallowed URL protocol/i);
  });

  it("runs AiSummaryNode in deterministic Demo AI local mode when keys are absent", async () => {
    const prevOpenAi = process.env.OPENAI_API_KEY;
    const prevGemini = process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "";
    process.env.GEMINI_API_KEY = "";

    const output = await executeAiSummaryNode(
      { nodeType: "ai_summary", label: "AI", prompt: "Clasificar orden" },
      {
        order: { total: 420 },
        customer: { tier: "VIP", email: "vip@test.dev" },
      },
    );

    expect(output.mode).toBe("Demo AI local");
    expect(output.classification).toBe("HIGH_PRIORITY_VIP");

    if (prevOpenAi) process.env.OPENAI_API_KEY = prevOpenAi;
    if (prevGemini) process.env.GEMINI_API_KEY = prevGemini;
  });

  it("replays from a failed node reusing upstream checkpoints", async () => {
    const nodes: FlowNode[] = [
      makeNode("t1", {
        nodeType: "trigger",
        label: "Trigger",
        payload: { item: "widget" },
      }),
      makeNode("tr1", {
        nodeType: "transform",
        label: "Transform",
        template: { itemName: "{{input.item}}" },
      }),
      makeNode("l1", {
        nodeType: "log_notify",
        label: "Notify",
        channel: "ops",
        messageTemplate: "Processed {{input.itemName}}",
      }),
    ];
    const edges: FlowEdge[] = [
      { id: "e1", source: "t1", target: "tr1" },
      { id: "e2", source: "tr1", target: "l1" },
    ];

    const prevLogs = [
      {
        nodeId: "t1",
        nodeType: "trigger" as const,
        status: "success" as const,
        inputJson: { item: "widget" },
        outputJson: { item: "checkpointed-widget" },
        errorMessage: null,
        durationMs: 2,
        executedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        nodeId: "tr1",
        nodeType: "transform" as const,
        status: "success" as const,
        inputJson: { item: "checkpointed-widget" },
        outputJson: { itemName: "checkpointed-widget" },
        errorMessage: null,
        durationMs: 3,
        executedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        nodeId: "l1",
        nodeType: "log_notify" as const,
        status: "failed" as const,
        inputJson: { itemName: "checkpointed-widget" },
        outputJson: {},
        errorMessage: "Simulated transient error",
        durationMs: 1,
        executedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const replay = await replayFromNode({
      nodes,
      edges,
      targetNodeId: "l1",
      previousLogs: prevLogs,
    });

    expect(replay.status).toBe("success");
    // Upstream nodes keep exact checkpoint timestamps/outputs
    expect(replay.nodeLogs.find((l) => l.nodeId === "t1")?.executedAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(
      replay.nodeLogs.find((l) => l.nodeId === "l1")?.outputJson.message,
    ).toBe("Processed checkpointed-widget");
  });

  it("validates env.ts fail-fast and SKIP_ENV_VALIDATION=true", () => {
    expect(() =>
      validateEnv({ NEXT_PUBLIC_APP_URL: "not-a-valid-url" }),
    ).toThrow(/Invalid environment configuration/);

    const skipped = validateEnv({
      NEXT_PUBLIC_APP_URL: "not-a-valid-url",
      SKIP_ENV_VALIDATION: "true",
    });
    expect(skipped.SKIP_ENV_VALIDATION).toBe("true");
  });

  it("serves /api/health, /api/openapi.json, RFC 7807 + x-request-id, and replay route", async () => {
    const healthRes = await getHealth(
      new Request("http://localhost:3006/api/health"),
    );
    expect(healthRes.status).toBe(200);
    expect(healthRes.headers.get("x-request-id")).toBeTruthy();
    const healthBody = (await healthRes.json()) as {
      status: string;
      service: string;
    };
    expect(healthBody.status).toBe("ok");
    expect(healthBody.service).toBe("flowforge-dag");

    const specRes = await getOpenApi(
      new Request("http://localhost:3006/api/openapi.json"),
    );
    expect(specRes.status).toBe(200);
    const spec = (await specRes.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/mcp"]).toBeDefined();

    // RFC 7807 on missing workflow
    const notFoundRes = await getWorkflowRoute(
      new Request("http://localhost:3006/api/workflows/missing-id", {
        headers: { "x-request-id": "req-rfc-404" },
      }),
      { params: Promise.resolve({ id: "missing-id" }) },
    );
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(notFoundRes.headers.get("x-request-id")).toBe("req-rfc-404");

    // Create + Execute + Replay via API routes
    const createRes = await createWorkflowRoute(
      new Request("http://localhost:3006/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Persistence Flow",
          description: "Vitest integration flow",
          nodes: [
            makeNode("t-1", {
              nodeType: "trigger",
              label: "Trigger",
              payload: { customer: { email: "test@flowforge.dev" } },
            }),
            makeNode("l-1", {
              nodeType: "log_notify",
              label: "Notify",
              channel: "ci",
              messageTemplate: "Email {{input.customer.email}}",
            }),
          ],
          edges: [{ id: "e-tl", source: "t-1", target: "l-1" }],
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const { workflow } = (await createRes.json()) as {
      workflow: { id: string };
    };

    const execRes = await executeWorkflowRoute(
      new Request(
        `http://localhost:3006/api/workflows/${workflow.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      ),
      { params: Promise.resolve({ id: workflow.id }) },
    );
    expect(execRes.status).toBe(200);
    const execData = (await execRes.json()) as {
      run: { id: string; status: string };
      nodeLogs: Array<{ nodeId: string }>;
    };
    expect(execData.run.status).toBe("success");
    expect(execData.nodeLogs).toHaveLength(2);

    const replayRes = await replayFromNodeRoute(
      new Request(
        `http://localhost:3006/api/runs/${execData.run.id}/replay-from/l-1`,
        {
          method: "POST",
        },
      ),
      { params: Promise.resolve({ runId: execData.run.id, nodeId: "l-1" }) },
    );
    expect(replayRes.status).toBe(200);
    const replayBody = (await replayRes.json()) as {
      replayedFromNodeId: string;
    };
    expect(replayBody.replayedFromNodeId).toBe("l-1");
  });

  it("exposes MCP tools list_workflows, validate_dag, and run_workflow via POST /api/mcp", async () => {
    const listRes = await postMcp(
      new Request("http://localhost:3006/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "list_workflows", arguments: {} },
        }),
      }),
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      result: { structuredContent: { workflows: Array<{ id: string }> } };
    };
    expect(
      listJson.result.structuredContent.workflows.length,
    ).toBeGreaterThanOrEqual(2);

    const valRes = await postMcp(
      new Request("http://localhost:3006/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "validate_dag",
            arguments: { workflowId: "wf-ecommerce-order-alert" },
          },
        }),
      }),
    );
    const valJson = (await valRes.json()) as {
      result: { structuredContent: { valid: boolean; levels: string[][] } };
    };
    expect(valJson.result.structuredContent.valid).toBe(true);
    expect(
      valJson.result.structuredContent.levels.length,
    ).toBeGreaterThanOrEqual(2);

    const runRes = await postMcp(
      new Request("http://localhost:3006/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "run_workflow",
            arguments: {
              workflowId: "wf-ecommerce-order-alert",
              triggerPayload: { order: { id: "ORD-MCP", total: 350 } },
            },
          },
        }),
      }),
    );
    const runJson = (await runRes.json()) as {
      result: { structuredContent: { run: { status: string } } };
    };
    expect(runJson.result.structuredContent.run.status).toBe("success");
  });
});
