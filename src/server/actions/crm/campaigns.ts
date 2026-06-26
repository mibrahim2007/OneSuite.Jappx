"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { db } from "@/lib/db";
import { campaigns, campaignRecipients, leads, crmContacts } from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionState = { success: true } | { success: false; error: string } | null;

const campaignSchema = z.object({
  name: z.string().min(1, "Name is required.").max(150),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(["email", "sms", "whatsapp"]).default("email"),
  subject: z.string().max(250).optional().nullable(),
  bodyHtml: z.string().optional().nullable(),
  targetLeadStatus: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
});

export async function saveCampaignAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("crm:campaign:manage", user);
  if (permError) return { success: false, error: permError.error };

  const id = (formData.get("id") as string)?.trim() || null;
  if (id && !UUID_RE.test(id)) return { success: false, error: "Invalid campaign ID." };

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    description: (formData.get("description") as string) || null,
    type: (formData.get("type") as string) || "email",
    subject: (formData.get("subject") as string) || null,
    bodyHtml: (formData.get("bodyHtml") as string) || null,
    targetLeadStatus: (formData.get("targetLeadStatus") as string) || null,
    scheduledAt: (formData.get("scheduledAt") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  const criteria = parsed.data.targetLeadStatus ? { leadStatus: parsed.data.targetLeadStatus } : {};

  try {
    await withTenantRLS(ctx, async (tx) => {
      const vals = {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        type: parsed.data.type,
        subject: parsed.data.subject ?? null,
        bodyHtml: parsed.data.bodyHtml ?? null,
        targetCriteria: criteria,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        updatedAt: new Date(),
      };
      if (id) {
        await tx.update(campaigns).set(vals)
          .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, user.tenant_id)));
      } else {
        await tx.insert(campaigns).values({ tenantId: user.tenant_id, ...vals, createdBy: user.sub });
      }
    });
  } catch {
    return { success: false, error: "Failed to save campaign." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "campaigns", entityId: id ?? "new", action: id ? "campaign_updated" : "campaign_created", changes: { name: parsed.data.name } }); } catch { /* non-fatal */ }
  revalidatePath("/app/crm/campaigns");
  return { success: true };
}

export async function launchCampaignAction(campaignId: string): Promise<{ success: boolean; error?: string; sentCount?: number }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(campaignId)) return { success: false, error: "Invalid ID." };

  const permError = requirePermission("crm:campaign:manage", user);
  if (permError) return { success: false, error: permError.error };

  // Fetch campaign
  const [campaign] = await db.select().from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, user.tenant_id))).limit(1);
  if (!campaign) return { success: false, error: "Campaign not found." };
  if (campaign.status !== "draft" && campaign.status !== "scheduled") return { success: false, error: "Campaign cannot be launched in its current state." };

  const criteria = campaign.targetCriteria as Record<string, string> | null;

  // Gather recipients from leads with emails, respecting targetLeadStatus criteria
  const leadsConditions = [
    eq(leads.tenantId, user.tenant_id),
    isNotNull(leads.email),
    ...(criteria?.leadStatus ? [eq(leads.status, criteria.leadStatus)] : []),
  ];
  const recipients = await db
    .select({ id: leads.id, email: leads.email, name: leads.name })
    .from(leads)
    .where(and(...leadsConditions));

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      // Insert recipients
      if (recipients.length > 0) {
        await tx.insert(campaignRecipients).values(
          recipients.map((l) => ({
            tenantId: user.tenant_id,
            campaignId,
            contactType: "lead" as const,
            contactId: l.id,
            email: l.email!,
            name: l.name || null,
            sentAt: new Date(),
          }))
        );
      }

      // Mark campaign as sent
      await tx.update(campaigns).set({
        status: "sent",
        sentAt: new Date(),
        recipientCount: recipients.length,
        updatedAt: new Date(),
      }).where(eq(campaigns.id, campaignId));
    });
  } catch {
    return { success: false, error: "Failed to launch campaign." };
  }

  revalidatePath("/app/crm/campaigns");
  return { success: true, sentCount: recipients.length };
}

export async function deleteCampaignAction(campaignId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(campaignId)) return { success: false, error: "Invalid ID." };

  const permError = requirePermission("crm:campaign:manage", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.delete(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to delete campaign." };
  }

  revalidatePath("/app/crm/campaigns");
  return { success: true };
}
