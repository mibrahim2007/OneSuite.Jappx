import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import type { Route } from "next";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { appraisalCycles, appraisals, appraisalKpis, employees } from "@/lib/db/schema";
import AppraisalCycleView from "@/components/app/hrm/appraisal-cycle-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AppraisalCyclePage({ params }: { params: Promise<{ cycle_id: string }> }) {
  const { cycle_id } = await params;
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  let user;
  try { user = await verifyAccessToken(token); } catch { redirect(`/api/auth/refresh?next=/app/hrm/appraisals/${cycle_id}`); }
  const permErr = requirePermission("hrm:appraisal:view", user);
  const selfErr = requirePermission("hrm:appraisal:self", user);
  if (permErr && selfErr) redirect("/app/dashboard");
  if (!UUID_RE.test(cycle_id)) redirect("/app/hrm/appraisals" as Route);

  const tid = user.tenant_id;
  const [[cycle], appraisalRows, kpiRows, emps] = await Promise.all([
    db.select().from(appraisalCycles)
      .where(and(eq(appraisalCycles.id, cycle_id), eq(appraisalCycles.tenantId, tid)))
      .limit(1),
    db.select().from(appraisals)
      .where(and(eq(appraisals.cycleId, cycle_id), eq(appraisals.tenantId, tid)))
      .orderBy(appraisals.createdAt),
    db.select().from(appraisalKpis),
    db.select({ id: employees.id, fullName: employees.fullName, empCode: employees.empCode })
      .from(employees).where(eq(employees.tenantId, tid)),
  ]);

  if (!cycle) redirect("/app/hrm/appraisals" as Route);

  const canManage = !requirePermission("hrm:appraisal:manage", user);
  const canSelf = !requirePermission("hrm:appraisal:self", user);

  return (
    <AppraisalCycleView
      cycle={cycle}
      appraisals={appraisalRows}
      kpis={kpiRows}
      employees={emps}
      currentUserId={user.sub}
      canManage={canManage}
      canSelf={canSelf}
    />
  );
}
