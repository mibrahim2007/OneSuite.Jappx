"use server";

import { cookies } from "next/headers";
import { and, eq, isNull, desc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { notifications } from "@/lib/db/schema";

async function getAuthCtx() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) throw new Error("Unauthorized");
  return verifyAccessToken(token);
}

export async function getNotifications() {
  const user = await getAuthCtx();
  return withTenantRLS(
    { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
    (tx) =>
      tx
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.tenantId, user.tenant_id),
            eq(notifications.userId, user.sub)
          )
        )
        .orderBy(desc(notifications.createdAt))
        .limit(20)
  );
}

export async function markNotificationRead(id: string) {
  const user = await getAuthCtx();
  return withTenantRLS(
    { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
    (tx) =>
      tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, user.sub),
            isNull(notifications.readAt)
          )
        )
  );
}

export async function markAllNotificationsRead() {
  const user = await getAuthCtx();
  return withTenantRLS(
    { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
    (tx) =>
      tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.tenantId, user.tenant_id),
            eq(notifications.userId, user.sub),
            isNull(notifications.readAt)
          )
        )
  );
}
