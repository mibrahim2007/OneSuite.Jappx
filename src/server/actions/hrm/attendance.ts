"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { attendance } from "@/lib/db/schema";
import { attendanceSchema } from "@/lib/validations/hrm";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionState = { success: true } | { success: false; error: string } | null;

export async function upsertAttendanceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:attendance:manage", user);
  if (permError) return permError;

  const parsed = attendanceSchema.safeParse({
    employeeId: formData.get("employeeId") as string,
    attDate: formData.get("attDate") as string,
    status: (formData.get("status") as string) || "present",
    workedHours: (formData.get("workedHours") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      // Check if record already exists for this employee + date
      const [existing] = await tx
        .select({ id: attendance.id })
        .from(attendance)
        .where(
          and(
            eq(attendance.tenantId, user.tenant_id),
            eq(attendance.employeeId, parsed.data.employeeId),
            eq(attendance.attDate, parsed.data.attDate)
          )
        )
        .limit(1);

      if (existing) {
        await tx.update(attendance)
          .set({
            status: parsed.data.status,
            workedHours: parsed.data.workedHours ?? null,
          })
          .where(eq(attendance.id, existing.id));
      } else {
        await tx.insert(attendance).values({
          tenantId: user.tenant_id,
          employeeId: parsed.data.employeeId,
          attDate: parsed.data.attDate,
          status: parsed.data.status,
          workedHours: parsed.data.workedHours ?? null,
        });
      }
    });
  } catch {
    return { success: false, error: "Failed to save attendance." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "attendance", action: "upsert" }); } catch {}
  revalidatePath("/app/hrm/attendance");
  return { success: true };
}

export async function deleteAttendanceAction(attendanceId: string): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:attendance:manage", user);
  if (permError) return permError;
  if (!UUID_RE.test(attendanceId)) return { success: false, error: "Invalid ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.delete(attendance)
        .where(and(eq(attendance.id, attendanceId), eq(attendance.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to delete attendance record." };
  }

  revalidatePath("/app/hrm/attendance");
  return { success: true };
}
