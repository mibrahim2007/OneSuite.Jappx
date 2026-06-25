import "server-only";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CreateNotificationParams = {
  userId: string;
  tenantId: string;
  title: string;
  body?: string;
  linkHref?: string;
};

export async function createNotification(
  params: CreateNotificationParams
): Promise<string> {
  const rows = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      tenantId: params.tenantId,
      title: params.title,
      body: params.body ?? null,
      linkHref: params.linkHref ?? null,
    })
    .returning({ id: notifications.id });

  const id = rows[0]?.id;
  if (!id) throw new Error("Failed to insert notification");

  // Broadcast so the browser client increments the badge in real time.
  // Wrapped in try/catch — DB insert is the source of truth; a Realtime
  // outage should never fail the caller's operation.
  try {
    const channel = supabaseAdmin.channel(`notifications:${params.userId}`);
    await channel.send({
      type: "broadcast",
      event: "new_notification",
      payload: { title: params.title },
    });
    await supabaseAdmin.removeChannel(channel);
  } catch {
    // Non-fatal: notification persisted in DB; client sees it on next drawer open
  }

  return id;
}
