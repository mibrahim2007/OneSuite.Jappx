import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, count, sum, and } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  invoices,
  bills,
  vehicles,
  trips,
  fuelLogs,
  employees,
  leads,
  opportunities,
  items,
  requisitions,
  purchaseOrders,
} from "@/lib/db/schema";
import { BIDashboard } from "@/components/app/analytics/bi-dashboard";

export default async function AnalyticsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/analytics");
  }

  const permError = requirePermission("accounts:report:view", user);
  if (permError) redirect("/app/dashboard");

  const tid = user.tenant_id;

  const [
    [revRow],
    [expRow],
    [arRow],
    [apRow],
    [invCnt],
    [billCnt],
    [vTotal],
    [vActive],
    [tripCnt],
    [fuelLtrs],
    [fuelCost],
    [leadCnt],
    [qualLeads],
    [oppCnt],
    [pipeVal],
    [wonCnt],
    [empCnt],
    [pendRQ],
    [openPO],
    [poSpend],
    [itemCnt],
  ] = await Promise.all([
    db.select({ v: sum(invoices.total) }).from(invoices)
      .where(and(eq(invoices.tenantId, tid), eq(invoices.status, "posted"))),
    db.select({ v: sum(bills.total) }).from(bills)
      .where(and(eq(bills.tenantId, tid), eq(bills.status, "posted"))),
    db.select({ v: sum(invoices.total) }).from(invoices)
      .where(and(eq(invoices.tenantId, tid), eq(invoices.status, "overdue"))),
    db.select({ v: sum(bills.total) }).from(bills)
      .where(and(eq(bills.tenantId, tid), eq(bills.status, "overdue"))),
    db.select({ v: count() }).from(invoices).where(eq(invoices.tenantId, tid)),
    db.select({ v: count() }).from(bills).where(eq(bills.tenantId, tid)),
    db.select({ v: count() }).from(vehicles).where(eq(vehicles.tenantId, tid)),
    db.select({ v: count() }).from(vehicles)
      .where(and(eq(vehicles.tenantId, tid), eq(vehicles.status, "active"))),
    db.select({ v: count() }).from(trips).where(eq(trips.tenantId, tid)),
    db.select({ v: sum(fuelLogs.litres) }).from(fuelLogs).where(eq(fuelLogs.tenantId, tid)),
    db.select({ v: sum(fuelLogs.cost) }).from(fuelLogs).where(eq(fuelLogs.tenantId, tid)),
    db.select({ v: count() }).from(leads).where(eq(leads.tenantId, tid)),
    db.select({ v: count() }).from(leads)
      .where(and(eq(leads.tenantId, tid), eq(leads.status, "qualified"))),
    db.select({ v: count() }).from(opportunities).where(eq(opportunities.tenantId, tid)),
    db.select({ v: sum(opportunities.amount) }).from(opportunities)
      .where(eq(opportunities.tenantId, tid)),
    db.select({ v: count() }).from(opportunities)
      .where(and(eq(opportunities.tenantId, tid), eq(opportunities.isWon, true))),
    db.select({ v: count() }).from(employees)
      .where(and(eq(employees.tenantId, tid), eq(employees.status, "active"))),
    db.select({ v: count() }).from(requisitions)
      .where(and(eq(requisitions.tenantId, tid), eq(requisitions.status, "submitted"))),
    db.select({ v: count() }).from(purchaseOrders)
      .where(and(eq(purchaseOrders.tenantId, tid), eq(purchaseOrders.status, "approved"))),
    db.select({ v: sum(purchaseOrders.total) }).from(purchaseOrders)
      .where(eq(purchaseOrders.tenantId, tid)),
    db.select({ v: count() }).from(items).where(eq(items.tenantId, tid)),
  ]);

  const stats = {
    finance: {
      revenue: parseFloat(revRow?.v ?? "0") || 0,
      expenses: parseFloat(expRow?.v ?? "0") || 0,
      overdueAR: parseFloat(arRow?.v ?? "0") || 0,
      overdueAP: parseFloat(apRow?.v ?? "0") || 0,
      invoiceCount: invCnt?.v ?? 0,
      billCount: billCnt?.v ?? 0,
      netProfit: (parseFloat(revRow?.v ?? "0") || 0) - (parseFloat(expRow?.v ?? "0") || 0),
    },
    fleet: {
      total: vTotal?.v ?? 0,
      active: vActive?.v ?? 0,
      trips: tripCnt?.v ?? 0,
      fuelLitres: parseFloat(fuelLtrs?.v ?? "0") || 0,
      fuelCost: parseFloat(fuelCost?.v ?? "0") || 0,
    },
    crm: {
      leads: leadCnt?.v ?? 0,
      qualifiedLeads: qualLeads?.v ?? 0,
      opportunities: oppCnt?.v ?? 0,
      pipelineValue: parseFloat(pipeVal?.v ?? "0") || 0,
      wonDeals: wonCnt?.v ?? 0,
    },
    hrm: { activeEmployees: empCnt?.v ?? 0 },
    procurement: {
      pendingRQs: pendRQ?.v ?? 0,
      approvedPOs: openPO?.v ?? 0,
      totalPOSpend: parseFloat(poSpend?.v ?? "0") || 0,
    },
    inventory: { itemCount: itemCnt?.v ?? 0 },
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Business Intelligence</h1>
      <p className="text-sm text-muted-foreground mt-1">Cross-module KPIs and analytics snapshot.</p>
      <div className="mt-6">
        <BIDashboard stats={stats} />
      </div>
    </div>
  );
}
