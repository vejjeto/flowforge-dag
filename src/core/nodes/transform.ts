import type { TransformNodeDataSchema } from "@/contracts/workflow";
import type { z } from "zod";
import { interpolateValue } from "./path-utils";

type TransformData = z.infer<typeof TransformNodeDataSchema>;

/**
 * Projects structured JSON using {{dot.path}} interpolation over the incoming node input.
 */
export function executeTransformNode(
  data: TransformData,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const projected = interpolateValue(data.template, input);
  if (
    projected !== null &&
    typeof projected === "object" &&
    !Array.isArray(projected)
  ) {
    return projected as Record<string, unknown>;
  }
  return { value: projected };
}
