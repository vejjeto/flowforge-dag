import type { FlowNode } from "@/contracts/workflow";
import { executeAiSummaryNode } from "./ai-summary";
import { executeConditionNode } from "./condition";
import { executeHttpRequestNode } from "./http-request";
import { executeLogNotifyNode } from "./log-notify";
import { executeTransformNode } from "./transform";
import { executeTriggerNode } from "./trigger";

export interface NodeDispatchResult {
  output: Record<string, unknown>;
  matchedBranch?: "true" | "false";
}

/**
 * Dispatches execution for any of the 6 FlowForge node types.
 */
export async function dispatchNodeExecution(
  node: FlowNode,
  input: Record<string, unknown>,
): Promise<NodeDispatchResult> {
  const { data } = node;
  switch (data.nodeType) {
    case "trigger":
      return { output: executeTriggerNode(data, input) };
    case "condition": {
      const result = executeConditionNode(data, input);
      return { output: result.output, matchedBranch: result.branch };
    }
    case "transform":
      return { output: executeTransformNode(data, input) };
    case "http":
      return { output: await executeHttpRequestNode(data, input) };
    case "ai_summary":
      return { output: await executeAiSummaryNode(data, input) };
    case "log_notify":
      return { output: executeLogNotifyNode(data, input) };
  }
}
