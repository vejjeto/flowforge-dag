import type {
  ConditionNodeDataSchema,
  ConditionOperator,
} from "@/contracts/workflow";
import type { z } from "zod";
import { getByDotPath } from "./path-utils";

type ConditionData = z.infer<typeof ConditionNodeDataSchema>;

function compareValues(
  actual: unknown,
  operator: ConditionOperator,
  expectedRaw: string,
): boolean {
  if (operator === "contains") {
    if (Array.isArray(actual)) {
      return actual.map(String).includes(expectedRaw);
    }
    return (
      actual !== undefined &&
      actual !== null &&
      String(actual).includes(expectedRaw)
    );
  }

  if (operator === ">" || operator === "<") {
    const numActual = typeof actual === "number" ? actual : Number(actual);
    const numExpected = Number(expectedRaw);
    if (!Number.isFinite(numActual) || !Number.isFinite(numExpected))
      return false;
    return operator === ">" ? numActual > numExpected : numActual < numExpected;
  }

  const normalizedActual =
    actual === undefined || actual === null ? "" : String(actual);
  return operator === "=="
    ? normalizedActual === expectedRaw
    : normalizedActual !== expectedRaw;
}

export interface ConditionEvaluationResult {
  matched: boolean;
  branch: "true" | "false";
  output: Record<string, unknown>;
}

/**
 * Evaluates a safe AST/rule condition without eval() or new Function().
 */
export function executeConditionNode(
  data: ConditionData,
  input: Record<string, unknown>,
): ConditionEvaluationResult {
  const actualValue = getByDotPath(input, data.fieldPath);
  const matched = compareValues(actualValue, data.operator, data.value);
  const branch = matched ? "true" : "false";

  return {
    matched,
    branch,
    output: {
      ...input,
      _condition: {
        fieldPath: data.fieldPath,
        operator: data.operator,
        expected: data.value,
        actual: actualValue ?? null,
        matched,
        branch,
      },
    },
  };
}
