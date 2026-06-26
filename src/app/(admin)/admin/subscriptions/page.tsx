import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { plans, subscriptions, tenants } from "@/lib/db/schema";
import { BillingDashboard } from "@/components/admin/billing-dashboard";

export default async function AdminSubscriptionsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/admin/subscriptions");
  }

  const permError = requirePermission("platform:billing:manage", user);
  if (permError) redirect("/admin/dashboard");

  const [allPlans, allSubs, allTenants] = await Promise.all([
    db.select().from(plans).orderBy(plans.name),
    db
      .select({
        id: subscriptions.id,
        tenantId: subscriptions.tenantId,
        tenantName: tenants.name,
        planId: subscriptions.planId,
        planName: plans.name,
        status: subscriptions.status,
        seats: subscriptions.seats,
        trialEndsAt: subscriptions.trialEndsAt,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .innerJoin(tenants, eq(subscriptions.tenantId, tenants.id))
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .orderBy(desc(subscriptions.createdAt)),
    db.select({ id: tenants.id, name: tenants.name }).from(tenants).orderBy(tenants.name),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Subscription Management</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage billing plans and tenant subscriptions.</p>
      <div className="mt-6">
        <BillingDashboard plans={allPlans} subscriptions={allSubs} tenants={allTenants} />
      </div>
    </div>
  );
}
