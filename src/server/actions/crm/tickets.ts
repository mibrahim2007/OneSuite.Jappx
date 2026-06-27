"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import { tickets } from "@/lib/db/schema";
import { ticketSchema, type TicketFormValues } from "@/lib/validations/tickets";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/crm/tickets";

function generateTicketNo(): string {
  const date = new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `TKT-${yyyymm}-${rand}`;
}

export async function createTicketAction(
  data: TicketFormValues
): Promise<{ success: boolean; error?: string; id?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:lead:create", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = ticketSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let id: string;
  try {
    const [row] = await withTenantRLS(ctx, async (tx) =>
      tx
        .insert(tickets)
        .values({
          tenantId: user.tenant_id,
          ticketNo: generateTicketNo(),
          subject: parsed.data.subject,
          description: parsed.data.description ?? null,
          companyId: parsed.data.companyId ?? null,
          contactId: parsed.data.contactId ?? null,
          priority: parsed.data.priority,
          status: parsed.data.status,
          assignedTo: parsed.data.assignedTo ?? null,
          dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        })
        .returning({ id: tickets.id })
    );
    id = row!.id;
  } catch {
    return { success: false, error: "Failed to create ticket." };
  }
  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "tickets",
      entityId: id,
      action: "created",
      changes: { subject: parsed.data.subject },
    });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true, id };
}

export async function updateTicketAction(
  id: string,
  data: TicketFormValues
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid ticket ID." };
  const permError = requirePermission("crm:lead:update", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = ticketSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let notFound = false;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: tickets.id, status: tickets.status })
        .from(tickets)
        .where(and(eq(tickets.id, id), eq(tickets.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing) { notFound = true; return; }

      const resolvedAt =
        parsed.data.status === "resolved" && existing.status !== "resolved"
          ? new Date()
          : parsed.data.status !== "resolved"
          ? null
          : undefined;

      await tx
        .update(tickets)
        .set({
          subject: parsed.data.subject,
          description: parsed.data.description ?? null,
          companyId: parsed.data.companyId ?? null,
          contactId: parsed.data.contactId ?? null,
          priority: parsed.data.priority,
          status: parsed.data.status,
          assignedTo: parsed.data.assignedTo ?? null,
          dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
          ...(resolvedAt !== undefined ? { resolvedAt } : {}),
        })
        .where(and(eq(tickets.id, id), eq(tickets.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update ticket." };
  }
  if (notFound) return { success: false, error: "Ticket not found." };
  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "tickets",
      entityId: id,
      action: "updated",
      changes: parsed.data,
    });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  revalidatePath(`/app/crm/tickets/${id}`);
  return { success: true };
}

export async function deleteTicketAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid ticket ID." };
  const permError = requirePermission("crm:lead:delete", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let blocked = false;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ status: tickets.status })
        .from(tickets)
        .where(and(eq(tickets.id, id), eq(tickets.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing || existing.status !== "closed") { blocked = true; return; }
      await tx.delete(tickets).where(and(eq(tickets.id, id), eq(tickets.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to delete ticket." };
  }
  if (blocked) return { success: false, error: "Only closed tickets can be deleted." };
  revalidatePath(REVALIDATE);
  return { success: true };
}
