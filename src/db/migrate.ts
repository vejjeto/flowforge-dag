import { logger } from "@/lib/logger";
import { checkDbHealth, getDb } from "./index";

async function main(): Promise<void> {
  await getDb();
  checkDbHealth();
  logger.info("FlowForge SQLite migration completed.");
}

main().catch((err) => {
  logger.error({ err }, "Migration failed");
  process.exit(1);
});
