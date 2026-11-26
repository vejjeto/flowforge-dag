import type { LogNotifyNodeDataSchema } from "@/contracts/workflow";
import type { z } from "zod";
import { interpolateString } from "./path-utils";

type LogNotifyData = z.infer<typeof LogNotifyNodeDataSchema>;

/**
 * Formats a structured notification log entry from the incoming payload.
 */
export function executeLogNotifyNode(
  data: LogNotifyData,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const message = interpolateString(data.messageTemplate, input);
  return {
    notified: true,
    channel: data.channel,
    level: "info",
    message,
    timestamp: new Date().toISOString(),
    snapshot: input,
  };
}
