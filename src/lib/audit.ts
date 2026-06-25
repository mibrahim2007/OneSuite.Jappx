import "server-only";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

type CreateAuditLogParams = {
  tenantId: string;
  userId: string;
  entity: string;
  entityId?: string | null;
  action: string;
  changes?: Record<string, unknown> | null;
};

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      tenantId: params.tenantId,
      userId: params.userId,
      entity: params.entity,
      entityId: params.entityId ?? null,
      action: params.action,
      changes: params.changes ?? null,
      ipAddress: null,
    });
  } catch {
    // Audit write failure is non-fatal — caller's mutation already succeeded
  }
}
