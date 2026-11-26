import { z } from "zod";

const OptionalNonEmptyString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

const OptionalUrlString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url().optional(),
);

export const EnvSchema = z.object({
  DATABASE_URL: OptionalNonEmptyString,
  POSTGRES_URL: OptionalNonEmptyString,
  NEXT_PUBLIC_APP_URL: OptionalUrlString,
  OPENAI_API_KEY: OptionalNonEmptyString,
  GEMINI_API_KEY: OptionalNonEmptyString,
  FLOWFORGE_DB_PATH: OptionalNonEmptyString,
  SKIP_ENV_VALIDATION: z.enum(["true", "false"]).optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

/**
 * Validates runtime environment variables with Zod, failing fast unless
 * SKIP_ENV_VALIDATION=true is explicitly set (e.g., during Docker/CI builds).
 */
export function validateEnv(
  rawEnv: Record<string, string | undefined> = process.env,
): AppEnv {
  if (rawEnv.SKIP_ENV_VALIDATION === "true") {
    return {
      DATABASE_URL: rawEnv.DATABASE_URL,
      POSTGRES_URL: rawEnv.POSTGRES_URL,
      NEXT_PUBLIC_APP_URL:
        rawEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3006",
      OPENAI_API_KEY: rawEnv.OPENAI_API_KEY,
      GEMINI_API_KEY: rawEnv.GEMINI_API_KEY,
      FLOWFORGE_DB_PATH: rawEnv.FLOWFORGE_DB_PATH,
      SKIP_ENV_VALIDATION: "true",
    };
  }

  const parsed = EnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return {
    ...parsed.data,
    NEXT_PUBLIC_APP_URL:
      parsed.data.NEXT_PUBLIC_APP_URL ?? "http://localhost:3006",
  };
}

export const env = validateEnv();
