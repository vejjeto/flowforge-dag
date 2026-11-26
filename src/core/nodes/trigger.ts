import type { TriggerNodeDataSchema } from "@/contracts/workflow";
import type { z } from "zod";

type TriggerData = z.infer<typeof TriggerNodeDataSchema>;

/**
 * Emits the initial workflow payload, merging runtime trigger payload over node defaults.
 */
export function executeTriggerNode(
  data: TriggerData,
  runtimeInput: Record<string, unknown>,
): Record<string, unknown> {
  const hasRuntimeKeys = Object.keys(runtimeInput).length > 0;
  return hasRuntimeKeys
    ? { ...data.payload, ...runtimeInput }
    : { ...data.payload };
}
