import { logger } from "@/lib/logger";
import { getDb, seedDatabase } from "./index";

async function main(): Promise<void> {
  const db = await getDb();
  const count = await seedDatabase(db);
  logger.info({ count }, "FlowForge seed completed.");
}

main().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
