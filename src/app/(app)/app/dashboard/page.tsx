import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import {
  Banknote,
  ReceiptText,
  FileInput,
  AlertTriangle,
  Truck,
  Route,
  Fuel,
  CalendarX2,
  Users,
  Layers,
  Bell,
  CalendarDays,
} from "lucide-react";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { ModuleBlockedToast } from "@/components/app/module-blocked-toast";
import { KpiCard } from "@/components/app/dashboard/kpi-card";
import { QuickActions, QUICK_ACTIONS } from "@/components/app/dashboard/quick-actions";
import { ActivityFeed } from "@/components/app/dashboard/activity-feed";

const ACCOUNTANT_KPIS = [
  { title: "Cash Position",      value: "—", icon: Banknote,      description: "Placeholder — data in a future epic" },
  { title: "AR Ageing",          value: "—", icon: ReceiptText,   description: "Placeholder — data in a future epic" },
  { title: "AP Ageing",          value: "—", icon: FileInput,     description: "Placeholder — data in a future epic" },
  { title: "Overdue Invoices",   value: "—", icon: AlertTriangle, description: "Placeholder — data in a future epic" },
] as const;

const FLEET_KPIS = [
  { title: "Vehicles Active",          value: "—", icon: Truck,      description: "Placeholder — data in a future epic" },
  { title: "Trips Today",              value: "—", icon: Route,      description: "Placeholder — data in a future epic" },
  { title: "Fuel Cost MTD",            value: "—", icon: Fuel,       description: "Placeholder — data in a future epic" },
  { title: "Documents Expiring Soon",  value: "—", icon: CalendarX2, description: "Placeholder — data in a future epic" },
] as const;

const GENERIC_KPIS = [
  { title: "Users",            value: "—", icon: Users,        description: "Placeholder — data in a future epic" },
  { title: "Modules Active",   value: "—", icon: Layers,       description: "Placeholder — data in a future epic" },
  { title: "Notifications",    value: "—", icon: Bell,         description: "Placeholder — data in a future epic" },
  { title: "Days Since Launch",value: "—", icon: CalendarDays, description: "Placeholder — data in a future epic" },
] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string }>;
}) {
  const { blocked } = await searchParams;

  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(accessToken);
  } catch {
    redirect("/api/auth/refresh?next=/app/dashboard");
  }

  const [activityRows, userRows] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        entity: auditLogs.entity,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, user.tenant_id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),

    db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, user.sub))
      .limit(1),
  ]);

  const fullName = userRows[0]?.fullName ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const hasAccountsPerms = user.permissions.some((p) => p.startsWith("accounts:"));
  const hasFleetPerms = user.permissions.some((p) => p.startsWith("fleet:"));

  const visibleActions = QUICK_ACTIONS.filter((a) =>
    user.permissions.includes(a.permCode)
  );

  const activityEntries = activityRows.map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt),
  }));

  return (
    <div className="p-6 space-y-8">
      <ModuleBlockedToast module={blocked ?? null} />

      <div>
        <h1 className="text-2xl font-semibold">
          {greeting}, {fullName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s what&apos;s happening across your organization.
        </p>
      </div>

      {hasAccountsPerms && (
        <section aria-labelledby="financial-kpis-heading">
          <h2
            id="financial-kpis-heading"
            className="text-lg font-semibold mb-4"
          >
            Financial KPIs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ACCOUNTANT_KPIS.map((kpi) => (
              <KpiCard key={kpi.title} {...kpi} />
            ))}
          </div>
        </section>
      )}

      {hasFleetPerms && (
        <section aria-labelledby="fleet-kpis-heading">
          <h2
            id="fleet-kpis-heading"
            className="text-lg font-semibold mb-4"
          >
            Fleet KPIs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FLEET_KPIS.map((kpi) => (
              <KpiCard key={kpi.title} {...kpi} />
            ))}
          </div>
        </section>
      )}

      {!hasAccountsPerms && !hasFleetPerms && (
        <section aria-labelledby="overview-kpis-heading">
          <h2
            id="overview-kpis-heading"
            className="text-lg font-semibold mb-4"
          >
            Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GENERIC_KPIS.map((kpi) => (
              <KpiCard key={kpi.title} {...kpi} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-lg font-semibold mb-4">
          Quick Actions
        </h2>
        <QuickActions items={visibleActions} />
      </section>

      <section aria-labelledby="activity-feed-heading">
        <h2 id="activity-feed-heading" className="text-lg font-semibold mb-4">
          Recent Activity
        </h2>
        <ActivityFeed entries={activityEntries} />
      </section>
    </div>
  );
}
