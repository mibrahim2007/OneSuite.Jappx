"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { db } from "@/lib/db";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { attachments } from "@/lib/db/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/audit";

// ─── Upload ──────────────────────────────────────────────────────────────────

type UploadState = { success: true } | { success: false; error: string } | null;

export async function uploadAttachmentAction(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const file = formData.get("file") as File | null;
  const entity = (formData.get("entity") as string | null)?.trim();
  const entityId = (formData.get("entityId") as string | null)?.trim();

  if (!file || file.size === 0) return { success: false, error: "No file selected." };
  if (!entity || !entityId) return { success: false, error: "Missing entity context." };
  if (file.size > 10 * 1024 * 1024) return { success: false, error: "File must be 10 MB or smaller." };

  const storagePath = `${user.tenant_id}/${entity}/${entityId}/${crypto.randomUUID()}-${file.name}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("entity-attachments")
    .upload(storagePath, bytes, { contentType: file.type });

  if (uploadError) return { success: false, error: "Upload failed. Please try again." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  await withTenantRLS(ctx, async (tx) => {
    await tx.insert(attachments).values({
      tenantId: user.tenant_id,
      uploadedBy: user.sub,
      entity,
      entityId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      storagePath,
    });
  });

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "attachments",
    entityId: null,
    action: "attachment_uploaded",
    changes: { fileName: file.name, fileSize: file.size, entity, entityId },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ─── Signed URL ───────────────────────────────────────────────────────────────

type SignedUrlResult = { success: true; url: string } | { success: false; error: string };

export async function getAttachmentSignedUrlAction(
  attachmentId: string
): Promise<SignedUrlResult> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const rows = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.tenantId, user.tenant_id)
      )
    )
    .limit(1);

  const attachment = rows[0];
  if (!attachment) return { success: false, error: "Not found." };

  const { data, error } = await supabaseAdmin.storage
    .from("entity-attachments")
    .createSignedUrl(attachment.storagePath, 60);

  if (error || !data?.signedUrl) return { success: false, error: "Could not generate download link." };

  return { success: true, url: data.signedUrl };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

type DeleteResult = { success: true } | { success: false; error: string };

export async function deleteAttachmentAction(
  attachmentId: string
): Promise<DeleteResult> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const rows = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.tenantId, user.tenant_id)
      )
    )
    .limit(1);

  const attachment = rows[0];
  if (!attachment) return { success: false, error: "Not found." };

  const isOwner = attachment.uploadedBy === user.sub;
  const isAdmin = user.permissions.some((p) => p.startsWith("admin:"));
  if (!isOwner && !isAdmin) return { success: false, error: "Permission denied." };

  await supabaseAdmin.storage
    .from("entity-attachments")
    .remove([attachment.storagePath]);

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  await withTenantRLS(ctx, async (tx) => {
    await tx
      .delete(attachments)
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.tenantId, user.tenant_id)
        )
      );
  });

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "attachments",
    entityId: attachmentId,
    action: "attachment_deleted",
    changes: { fileName: attachment.fileName },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
