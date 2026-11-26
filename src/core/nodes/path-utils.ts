const BLOCKED_PATH_SEGMENTS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/**
 * Safely resolves a dot-separated path (e.g. "input.order.total" or "order.total")
 * without using eval or allowing prototype traversal.
 */
export function getByDotPath(
  root: Record<string, unknown>,
  rawPath: string,
): unknown {
  const trimmed = rawPath.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.startsWith("input.") ? trimmed.slice(6) : trimmed;
  if (!normalized || normalized === "input") return root;

  const segments = normalized.split(".");
  let current: unknown = root;

  for (const segment of segments) {
    if (!segment || BLOCKED_PATH_SEGMENTS.has(segment)) return undefined;
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return undefined;
    }
    current = record[segment];
  }

  return current;
}

/**
 * Interpolates {{dot.path}} placeholders inside strings using values from rootInput.
 */
export function interpolateString(
  template: string,
  rootInput: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) => {
    const resolved = getByDotPath(rootInput, expr);
    if (resolved === undefined || resolved === null) return "";
    if (typeof resolved === "object") return JSON.stringify(resolved);
    return String(resolved);
  });
}

/**
 * Recursively interpolates all string leaves inside an arbitrary JSON-compatible value.
 */
export function interpolateValue(
  value: unknown,
  rootInput: Record<string, unknown>,
): unknown {
  if (typeof value === "string") {
    return interpolateString(value, rootInput);
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, rootInput));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (BLOCKED_PATH_SEGMENTS.has(key)) continue;
      out[key] = interpolateValue(entry, rootInput);
    }
    return out;
  }
  return value;
}
