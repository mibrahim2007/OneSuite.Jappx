"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { employees } from "@/lib/db/schema";
import { employeeSchema } from "@/lib/validations/hrm";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionState = { success: true } | { success: false; error: string } | null;

function parseEmployeeForm(formData: FormData) {
  return employeeSchema.safeParse({
    empCode: (formData.get("empCode") as string)?.trim(),
    fullName: (formData.get("fullName") as string)?.trim(),
    email: (formData.get("email") as string)?.trim() || null,
    phone: (formData.get("phone") as string)?.trim() || null,
    departmentId: (formData.get("departmentId") as string) || null,
    designationId: (formData.get("designationId") as string) || null,
    managerId: (formData.get("managerId") as string) || null,
    joinDate: (formData.get("joinDate") as string) || null,
    status: (formData.get("status") as string) || "active",
    cnic: (formData.get("cnic") as string)?.trim() || null,
  });
}

export async function createEmployeeAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:employee:create", user);
  if (permError) return permError;

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let result: { duplicate: boolean };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      try {
        await tx.insert(employees).values({
          tenantId: user.tenant_id,
          empCode: parsed.data.empCode,
          fullName: parsed.data.fullName,
          email: parsed.data.email ?? null,
          phone: parsed.data.phone ?? null,
          departmentId: parsed.data.departmentId ?? null,
          designationId: parsed.data.designationId ?? null,
          managerId: parsed.data.managerId ?? null,
          joinDate: parsed.data.joinDate ?? null,
          status: parsed.data.status,
          cnic: parsed.data.cnic ?? null,
        });
        return { duplicate: false };
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
          return { duplicate: true };
        }
        throw err;
      }
    });
  } catch {
    return { success: false, error: "Failed to create employee." };
  }

  if (result.duplicate) return { success: false, error: "Employee code already in use." };

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "employee", action: "create" }); } catch {}
  revalidatePath("/app/hrm/employees");
  return { success: true };
}

export async function updateEmployeeAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:employee:update", user);
  if (permError) return permError;

  const id = formData.get("id") as string;
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid employee ID." };

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(employees)
        .set({
          fullName: parsed.data.fullName,
          email: parsed.data.email ?? null,
          phone: parsed.data.phone ?? null,
          departmentId: parsed.data.departmentId ?? null,
          designationId: parsed.data.designationId ?? null,
          managerId: parsed.data.managerId ?? null,
          joinDate: parsed.data.joinDate ?? null,
          status: parsed.data.status,
          cnic: parsed.data.cnic ?? null,
        })
        .where(and(eq(employees.id, id), eq(employees.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update employee." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "employee", entityId: id, action: "update" }); } catch {}
  revalidatePath("/app/hrm/employees");
  return { success: true };
}
