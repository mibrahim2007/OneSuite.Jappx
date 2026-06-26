import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { appraisalCycles } from "@/lib/db/schema";
import AppraisalsView from "@/components/app/hrm/appraisals-view";

export default async function AppraisalsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  let user;
  try { user = await verifyAccessToken(token); } catch { redirect("/api/auth/refresh?next=/app/hrm/appraisals"); }
  const permErr = requirePermission("hrm:appraisal:view", user);
  const selfErr = requirePermission("hrm:appraisal:self", user);
  if (permErr && selfErr) redirect("/app/dashboard");

  const tid = user.tenant_id;
  const cycles = await db.select().from(appraisalCycles).where(eq(appraisalCycles.tenantId, tid)).orderBy(appraisalCycles.createdAt);

  const canManage = !requirePermission("hrm:appraisal:manage", user);

  return <AppraisalsView cycles={cycles} canManage={canManage} />;
}
