import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Pooler URL required for serverless (Vercel). prepare:false required for PgBouncer transaction mode.
const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  prepare: false,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
