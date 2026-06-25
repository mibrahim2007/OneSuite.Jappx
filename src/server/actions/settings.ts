"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/audit";

type SettingsActionState = { success: true } | { success: false; error: string } | null;

const companySchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100),
  legalName: z.string().max(200).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Must be a valid hex color")
    .or(z.literal(""))
    .optional(),
  baseCurrency: z.string().length(3, "Must be a 3-letter ISO currency code"),
  timezone: z.string().min(1, "Timezone is required"),
  fiscalStartMonth: z.coerce.number().int().min(1).max(12),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
});

export async function updateCompanyProfileAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) return { success: false, error: "Not authenticated." };

  let user;
  try {
    user = await verifyAccessToken(accessToken);
  } catch {
    return { success: false, error: "Session expired. Please log in again." };
  }

  const permError = requirePermission("admin:settings:update", user);
  if (permError) return { success: false, error: "Permission denied." };

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") || undefined,
    accentColor: formData.get("accentColor") || undefined,
    baseCurrency: formData.get("baseCurrency"),
    timezone: formData.get("timezone"),
    fiscalStartMonth: formData.get("fiscalStartMonth"),
    addressLine1: formData.get("addressLine1") || undefined,
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    country: formData.get("country") || undefined,
    postalCode: formData.get("postalCode") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  // Handle logo file upload
  let newLogoUrl: string | undefined;
  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    if (logoFile.size > 2 * 1024 * 1024) {
      return { success: false, error: "Logo must be 2 MB or smaller." };
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(logoFile.type)) {
      return { success: false, error: "Logo must be a PNG, JPEG, or WebP image." };
    }
    const ext = logoFile.type === "image/png" ? "png" : logoFile.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.tenant_id}/logo.${ext}`;
    const bytes = Buffer.from(await logoFile.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from("tenant-assets")
      .upload(path, bytes, { contentType: logoFile.type, upsert: true });
    if (uploadError) {
      return { success: false, error: "Logo upload failed. Please try again." };
    }
    const { data: urlData } = supabaseAdmin.storage.from("tenant-assets").getPublicUrl(path);
    newLogoUrl = urlData.publicUrl;
  }

  // Merge address into settings JSONB
  const [currentRow] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, user.tenant_id))
    .limit(1);
  const currentSettings = (currentRow?.settings as Record<string, unknown>) ?? {};
  const updatedSettings = {
    ...currentSettings,
    address: {
      line1: data.addressLine1 ?? "",
      line2: data.addressLine2 ?? "",
      city: data.city ?? "",
      state: data.state ?? "",
      country: data.country ?? "",
      postalCode: data.postalCode ?? "",
    },
  };

  await db
    .update(tenants)
    .set({
      name: data.name,
      legalName: data.legalName ?? null,
      accentColor: data.accentColor || null,
      baseCurrency: data.baseCurrency,
      timezone: data.timezone,
      fiscalStartMonth: data.fiscalStartMonth,
      settings: updatedSettings,
      updatedAt: new Date(),
      ...(newLogoUrl ? { logoUrl: newLogoUrl } : {}),
    })
    .where(eq(tenants.id, user.tenant_id));

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "tenant",
    entityId: user.tenant_id,
    action: "tenant_updated",
    changes: null,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");

  return { success: true };
}
