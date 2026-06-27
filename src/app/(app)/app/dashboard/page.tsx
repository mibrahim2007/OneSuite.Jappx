import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, desc, sum, count, and, isNull, or, sql } from "drizzle-orm";
import {
  Banknote,
  ReceiptText,
  FileInput,
  AlertTriangle,
  Truck,
  Route,
  Fuel,
  Users,
  Layers,
  Bell,
  Package,
} from "lucide-react";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import {
  auditLogs,
  users,
  invoices,
  bills,
  vehicles,
  trips,
  fuelLogs,
  employees,
  subscriptions,
  notifications,
  items,
} from "@/lib/db/schema";
import { ModuleBlockedToast } from "@/components/app/module-blocked-toast";
import { KpiCard } from "@/components/app/dashboard/kpi-card";
import { QuickActions, QUICK_ACTIONS } from "@/components/app/dashboard/quick-actions";
import { ActivityFeed } from "@/components/app/dashboard/activity-feed";
import { RevenueChart } from "@/components/app/dashboard/revenue-chart";
import { TripsChart } from "@/components/app/dashboard/trips-chart";
import type { MonthlyPoint } from "@/components/app/dashboard/revenue-chart";
import type { TripPoint } from "@/components/app/dashboard/trips-chart";

// Re-exported so KpiCard sections stay typed
type KpiItem = {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

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

  const tid = user.tenant_id;
  const hasAccountsPerms = user.permissions.some((p) => p.startsWith("accounts:"));
  const hasFleetPerms = user.permissions.some((p) => p.startsWith("fleet:"));

  // Run all queries in one round-trip — only use results that match the user's role
  const [
    activityRows,
    userRows,
    // Finance
    revRow,
    overdueARRow,
    overdueAPRow,
    overdueInvCountRow,
    // Fleet
    activeVehiclesRow,
    totalVehiclesRow,
    tripsRow,
    fuelCostRow,
    fuelLitresRow,
    // Generic / always-needed
    activeEmployeesRow,
    itemCountRow,
    unreadNotifsRow,
    enabledModulesRow,
    // Trends
    revenueByMonth,
    expensesByMonth,
    tripsByMonth,
  ] = await Promise.all([
    // Activity feed
    db
      .select({
        id: auditLogs.id,
        entity: auditLogs.entity,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, tid))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),

    // User name for greeting
    db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, user.sub))
      .limit(1),

    // Finance — posted invoice revenue
    db
      .select({ v: sum(invoices.total) })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tid), eq(invoices.status, "posted"))),

    // Finance — overdue AR
    db
      .select({ v: sum(invoices.total) })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tid), eq(invoices.status, "overdue"))),

    // Finance — overdue AP
    db
      .select({ v: sum(bills.total) })
      .from(bills)
      .where(and(eq(bills.tenantId, tid), eq(bills.status, "overdue"))),

    // Finance — overdue invoice count
    db
      .select({ v: count() })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tid), eq(invoices.status, "overdue"))),

    // Fleet — active vehicles
    db
      .select({ v: count() })
      .from(vehicles)
      .where(and(eq(vehicles.tenantId, tid), eq(vehicles.status, "active"))),

    // Fleet — total vehicles
    db
      .select({ v: count() })
      .from(vehicles)
      .where(eq(vehicles.tenantId, tid)),

    // Fleet — total trips
    db
      .select({ v: count() })
      .from(trips)
      .where(eq(trips.tenantId, tid)),

    // Fleet — total fuel cost
    db
      .select({ v: sum(fuelLogs.cost) })
      .from(fuelLogs)
      .where(eq(fuelLogs.tenantId, tid)),

    // Fleet — total fuel litres
    db
      .select({ v: sum(fuelLogs.litres) })
      .from(fuelLogs)
      .where(eq(fuelLogs.tenantId, tid)),

    // Always — active employees
    db
      .select({ v: count() })
      .from(employees)
      .where(and(eq(employees.tenantId, tid), eq(employees.status, "active"))),

    // Always — catalogued stock items
    db
      .select({ v: count() })
      .from(items)
      .where(eq(items.tenantId, tid)),

    // Always — unread notifications for this user
    db
      .select({ v: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, tid),
          eq(notifications.userId, user.sub),
          isNull(notifications.readAt)
        )
      ),

    // Always — enabled modules from subscription
    db
      .select({ enabledModules: subscriptions.enabledModules })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, tid),
          or(
            eq(subscriptions.status, "active"),
            eq(subscriptions.status, "trialing")
          )
        )
      )
      .limit(1),

    // Trends — monthly posted revenue (last 6 months)
    db
      .select({
        month: sql<string>`to_char(${invoices.invoiceDate}::date, 'YYYY-MM')`,
        total: sql<string>`sum(${invoices.total})::text`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tid),
          eq(invoices.status, "posted"),
          sql`${invoices.invoiceDate}::date >= date_trunc('month', now()) - interval '5 months'`
        )
      )
      .groupBy(sql`to_char(${invoices.invoiceDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${invoices.invoiceDate}::date, 'YYYY-MM')`),

    // Trends — monthly posted expenses (last 6 months)
    db
      .select({
        month: sql<string>`to_char(${bills.billDate}::date, 'YYYY-MM')`,
        total: sql<string>`sum(${bills.total})::text`,
      })
      .from(bills)
      .where(
        and(
          eq(bills.tenantId, tid),
          eq(bills.status, "posted"),
          sql`${bills.billDate}::date >= date_trunc('month', now()) - interval '5 months'`
        )
      )
      .groupBy(sql`to_char(${bills.billDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${bills.billDate}::date, 'YYYY-MM')`),

    // Trends — monthly trips (last 6 months)
    db
      .select({
        month: sql<string>`to_char(${trips.startAt}::date, 'YYYY-MM')`,
        cnt: sql<string>`count(*)::text`,
      })
      .from(trips)
      .where(
        and(
          eq(trips.tenantId, tid),
          sql`${trips.startAt} is not null`,
          sql`${trips.startAt}::date >= date_trunc('month', now()) - interval '5 months'`
        )
      )
      .groupBy(sql`to_char(${trips.startAt}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${trips.startAt}::date, 'YYYY-MM')`),
  ]);

  // ── Derived values ────────────────────────────────────────────────────────

  const fullName = userRows[0]?.fullName ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const postedRevenue  = parseFloat(revRow[0]?.v        ?? "0") || 0;
  const overdueAR      = parseFloat(overdueARRow[0]?.v  ?? "0") || 0;
  const overdueAP      = parseFloat(overdueAPRow[0]?.v  ?? "0") || 0;
  const overdueCount   = overdueInvCountRow[0]?.v ?? 0;
  const netPosition    = postedRevenue - overdueAP;

  const activeVehicles = activeVehiclesRow[0]?.v ?? 0;
  const totalVehicles  = totalVehiclesRow[0]?.v  ?? 0;
  const totalTrips     = tripsRow[0]?.v          ?? 0;
  const fuelCost       = parseFloat(fuelCostRow[0]?.v   ?? "0") || 0;
  const fuelLitres     = parseFloat(fuelLitresRow[0]?.v ?? "0") || 0;
  const utilisation    = totalVehicles > 0
    ? Math.round((activeVehicles / totalVehicles) * 100)
    : 0;

  const activeEmployees  = activeEmployeesRow[0]?.v ?? 0;
  const itemCount        = itemCountRow[0]?.v        ?? 0;
  const unreadNotifs     = unreadNotifsRow[0]?.v     ?? 0;
  const enabledModCount  = (enabledModulesRow[0]?.enabledModules ?? []).length;

  // ── Trend chart data ─────────────────────────────────────────────────────

  // Build last-6-months spine so missing months show as 0
  const last6: string[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });

  const revMap = new Map(revenueByMonth.map((r) => [r.month, parseFloat(r.total) || 0]));
  const expMap = new Map(expensesByMonth.map((r) => [r.month, parseFloat(r.total) || 0]));
  const trpMap = new Map(tripsByMonth.map((r) => [r.month, parseInt(r.cnt, 10) || 0]));

  const revenueChartData: MonthlyPoint[] = last6.map((m) => ({
    month: m,
    revenue: revMap.get(m) ?? 0,
    expenses: expMap.get(m) ?? 0,
  }));

  const tripsChartData: TripPoint[] = last6.map((m) => ({
    month: m,
    trips: trpMap.get(m) ?? 0,
  }));

  // ── KPI definitions ───────────────────────────────────────────────────────

  const ACCOUNTANT_KPIS: KpiItem[] = [
    {
      title: "Revenue (Posted)",
      value: `PKR ${fmt(postedRevenue)}`,
      icon: Banknote,
      description: "From posted invoices",
    },
    {
      title: "Overdue AR",
      value: overdueAR > 0 ? `PKR ${fmt(overdueAR)}` : "—",
      icon: ReceiptText,
      description: `${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""}`,
    },
    {
      title: "Overdue AP",
      value: overdueAP > 0 ? `PKR ${fmt(overdueAP)}` : "—",
      icon: FileInput,
      description: "From vendor bills",
    },
    {
      title: "Net Position",
      value: `PKR ${fmt(Math.abs(netPosition))}`,
      icon: AlertTriangle,
      description: netPosition >= 0 ? "Revenue ahead of AP" : "AP exceeds revenue",
    },
  ];

  const FLEET_KPIS: KpiItem[] = [
    {
      title: "Active Vehicles",
      value: String(activeVehicles),
      icon: Truck,
      description: `${utilisation}% utilisation · ${totalVehicles} total`,
    },
    {
      title: "Total Trips",
      value: fmt(totalTrips),
      icon: Route,
      description: "All recorded trips",
    },
    {
      title: "Fuel Cost",
      value: fuelCost > 0 ? `PKR ${fmt(fuelCost)}` : "—",
      icon: Fuel,
      description: fuelLitres > 0 ? `${fmt(fuelLitres)} litres consumed` : "No fuel logs yet",
    },
    {
      title: "Active Employees",
      value: String(activeEmployees),
      icon: Users,
      description: "Across all departments",
    },
  ];

  const GENERIC_KPIS: KpiItem[] = [
    {
      title: "Active Employees",
      value: String(activeEmployees),
      icon: Users,
      description: "Across all departments",
    },
    {
      title: "Modules Active",
      value: String(enabledModCount),
      icon: Layers,
      description: "In your subscription",
    },
    {
      title: "Notifications",
      value: String(unreadNotifs),
      icon: Bell,
      description: unreadNotifs === 1 ? "1 unread" : `${unreadNotifs} unread`,
    },
    {
      title: "Stock Items",
      value: fmt(itemCount),
      icon: Package,
      description: "Catalogued in inventory",
    },
  ];

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
          <h2 id="financial-kpis-heading" className="text-lg font-semibold mb-4">
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
          <h2 id="fleet-kpis-heading" className="text-lg font-semibold mb-4">
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
          <h2 id="overview-kpis-heading" className="text-lg font-semibold mb-4">
            Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GENERIC_KPIS.map((kpi) => (
              <KpiCard key={kpi.title} {...kpi} />
            ))}
          </div>
        </section>
      )}

      {(hasAccountsPerms || hasFleetPerms) && (
        <section aria-labelledby="trends-heading">
          <h2 id="trends-heading" className="text-lg font-semibold mb-4">
            Trends — Last 6 Months
          </h2>
          <div className={`grid gap-4 ${hasAccountsPerms && hasFleetPerms ? "lg:grid-cols-3" : "grid-cols-1"}`}>
            {hasAccountsPerms && (
              <div className={`rounded-lg border bg-card p-4 ${hasFleetPerms ? "lg:col-span-2" : ""}`}>
                <p className="text-sm font-medium text-muted-foreground mb-3">Revenue vs Expenses (PKR)</p>
                <RevenueChart data={revenueChartData} />
              </div>
            )}
            {hasFleetPerms && (
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Trips per Month</p>
                <TripsChart data={tripsChartData} />
              </div>
            )}
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
