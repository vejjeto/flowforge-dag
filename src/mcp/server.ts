import readline from "node:readline";
import { logger } from "@/lib/logger";
import { handleJsonRpcRequest } from "./tools";

function main(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const payload = JSON.parse(trimmed) as unknown;
      const response = await handleJsonRpcRequest(payload);
      process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (err) {
      logger.error({ err }, "Invalid JSON received on MCP stdio");
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        })}\n`,
      );
    }
  });
}

main();
