import pino from "pino";

export const logger = pino({
  name: "flowforge-dag",
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "test" ? "silent" : "info"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.apiKey",
      "*.token",
      "*.password",
      "*.secret",
      "OPENAI_API_KEY",
      "GEMINI_API_KEY",
      "DATABASE_URL",
      "POSTGRES_URL",
    ],
    censor: "[REDACTED]",
  },
});

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
