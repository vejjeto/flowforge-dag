import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import { SEED_WORKFLOWS } from "./seed-data";

const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  nodes_json TEXT NOT NULL,
  edges_json TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  trigger_payload TEXT NOT NULL,
  total_duration_ms INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS node_execution_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT NOT NULL,
  error_message TEXT,
  duration_ms INTEGER NOT NULL,
  executed_at TEXT NOT NULL
);
`;

function toSqlInput(value: unknown): SQLInputValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (value instanceof Uint8Array) return value;
  return JSON.stringify(value);
}

function resolveDbPath(): string {
  const configured = process.env.FLOWFORGE_DB_PATH?.trim();
  if (configured) return configured;
  return path.resolve(process.cwd(), "flowforge.db");
}

function createDrizzleSqlite(sqlite: DatabaseSync) {
  return drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql);
      const bound = params.map(toSqlInput);
      if (method === "run") {
        stmt.run(...bound);
        return { rows: [] };
      }
      if (method === "get") {
        stmt.setReturnArrays(true);
        const row = stmt.get(...bound);
        return { rows: (row ?? undefined) as unknown as unknown[] };
      }
      stmt.setReturnArrays(true);
      return { rows: stmt.all(...bound) as unknown as unknown[][] };
    },
    { schema },
  );
}

export type FlowForgeDb = ReturnType<typeof createDrizzleSqlite>;

interface DbState {
  sqlite: DatabaseSync;
  db: FlowForgeDb;
  dbPath: string;
  seeded: boolean;
}

const globalForDb = globalThis as unknown as {
  __flowforgeDb?: DbState | undefined;
};

export function initSchema(sqlite: DatabaseSync): void {
  sqlite.exec(CREATE_TABLES_SQL);
}

export async function seedDatabase(db: FlowForgeDb): Promise<number> {
  const now = new Date().toISOString();
  let inserted = 0;
  for (const tpl of SEED_WORKFLOWS) {
    await db
      .insert(schema.workflows)
      .values({
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        nodesJson: JSON.stringify(tpl.nodes),
        edgesJson: JSON.stringify(tpl.edges),
        isDemo: tpl.isDemo,
        updatedAt: now,
      })
      .onConflictDoNothing();
    inserted += 1;
  }
  return inserted;
}

function getOrCreateState(): DbState {
  const targetPath = resolveDbPath();
  if (
    globalForDb.__flowforgeDb &&
    globalForDb.__flowforgeDb.dbPath === targetPath
  ) {
    return globalForDb.__flowforgeDb;
  }
  if (globalForDb.__flowforgeDb) {
    globalForDb.__flowforgeDb.sqlite.close();
  }
  const sqlite = new DatabaseSync(targetPath);
  initSchema(sqlite);
  const db = createDrizzleSqlite(sqlite);
  const state: DbState = { sqlite, db, dbPath: targetPath, seeded: false };
  globalForDb.__flowforgeDb = state;
  return state;
}

/**
 * Returns the initialized Drizzle SQLite instance, auto-migrating and seeding once on first access.
 */
export async function getDb(): Promise<FlowForgeDb> {
  const state = getOrCreateState();
  if (!state.seeded) {
    state.seeded = true;
    await seedDatabase(state.db);
  }
  return state.db;
}

/**
 * Runs a lightweight SQLite connectivity check for /api/health.
 */
export function checkDbHealth(): void {
  const state = getOrCreateState();
  state.sqlite.prepare("SELECT 1").get();
}

/**
 * Resets cached SQLite connection (used in automated tests when switching DB paths).
 */
export function resetDbConnection(): void {
  if (globalForDb.__flowforgeDb) {
    globalForDb.__flowforgeDb.sqlite.close();
    globalForDb.__flowforgeDb = undefined;
  }
}
