import * as schema from "@shared/schema";

export let db: any = undefined;
export let pool: any = undefined;

if (process.env.USE_SQLITE_TEST === '1') {
  // use an in-memory sqlite database for tests (ESM-safe dynamic imports)
  const { default: Database } = await import('better-sqlite3');
  const { drizzle: sqliteDrizzle } = await import('drizzle-orm/better-sqlite3');

  const sqliteDb = new Database(':memory:');
  db = sqliteDrizzle(sqliteDb, { schema });
} else {
  // production/normal path uses Neon Postgres; perform dynamic imports
  // with top-level await so initialization completes before consumers use `db`.
  try {
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const { drizzle: neonDrizzle } = await import('drizzle-orm/neon-serverless');
    const ws = await import('ws');
    neonConfig.webSocketConstructor = ws.default || ws;

    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = neonDrizzle({ client: pool, schema });
  } catch (err) {
    console.error('Error initializing Neon DB:', err);
    throw err;
  }
}
