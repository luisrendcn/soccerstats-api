import * as schema from "@shared/schema";

const { Pool, neonConfig } = await import("@neondatabase/serverless");
const { drizzle: neonDrizzle } = await import("drizzle-orm/neon-serverless");
const ws = await import("ws");

neonConfig.webSocketConstructor = ws.default || ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = neonDrizzle({ client: pool, schema });
