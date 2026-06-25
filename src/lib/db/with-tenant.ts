import { sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { db } from "./index";
import * as schema from "./schema";

type Transaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export interface TenantContext {
  tenantId: string;
  userId: string;
  permissions: string[];
}

/**
 * Wraps a DB operation in a transaction that sets JWT claims so RLS policies fire correctly.
 * All tenant-scoped server actions must go through this wrapper — never raw `db` for user data.
 */
export async function withTenantRLS<T>(
  ctx: TenantContext,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = JSON.stringify({
      tenant_id: ctx.tenantId,
      sub: ctx.userId,
      permissions: ctx.permissions,
    });
    await tx.execute(
      sql`SELECT set_config('request.jwt.claims', ${claims}, true)`
    );
    return fn(tx);
  });
}
