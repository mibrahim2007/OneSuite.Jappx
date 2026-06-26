"use client";

import {
  TrendingUp, TrendingDown, Truck, Users, ShoppingCart,
  BarChart3, Globe, Package, Briefcase, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Stats = {
  finance: {
    revenue: number; expenses: number; overdueAR: number;
    overdueAP: number; invoiceCount: number; billCount: number; netProfit: number;
  };
  fleet: { total: number; active: number; trips: number; fuelLitres: number; fuelCost: number };
  crm: { leads: number; qualifiedLeads: number; opportunities: number; pipelineValue: number; wonDeals: number };
  hrm: { activeEmployees: number };
  procurement: { pendingRQs: number; approvedPOs: number; totalPOSpend: number };
  inventory: { itemCount: number };
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function StatCard({
  title, value, sub, icon: Icon, trend,
}: { title: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; trend?: "up" | "down" | "neutral" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
            {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{fmt(value)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full">
        <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function BIDashboard({ stats }: { stats: Stats }) {
  const { finance, fleet, crm, hrm, procurement, inventory } = stats;
  const utilisation = fleet.total > 0 ? Math.round((fleet.active / fleet.total) * 100) : 0;
  const conversionRate = crm.leads > 0 ? Math.round((crm.wonDeals / crm.leads) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Financial Summary */}
      <section>
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Financial Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Revenue" value={`PKR ${fmt(finance.revenue)}`}
            sub={`${finance.invoiceCount} invoices`} icon={TrendingUp} trend="up" />
          <StatCard title="Total Expenses" value={`PKR ${fmt(finance.expenses)}`}
            sub={`${finance.billCount} bills`} icon={TrendingDown} trend={finance.expenses > finance.revenue ? "down" : "neutral"} />
          <StatCard title="Net Profit"
            value={`PKR ${fmt(Math.abs(finance.netProfit))}`}
            sub={finance.netProfit >= 0 ? "Surplus" : "Deficit"}
            icon={Activity}
            trend={finance.netProfit >= 0 ? "up" : "down"} />
          <StatCard title="Overdue AR" value={`PKR ${fmt(finance.overdueAR)}`}
            sub={`AP: PKR ${fmt(finance.overdueAP)}`} icon={TrendingDown}
            trend={finance.overdueAR > 0 ? "down" : "neutral"} />
        </div>
      </section>

      {/* Module KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Fleet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="h-4 w-4" /> Fleet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold">{fleet.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{fleet.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{utilisation}%</p>
                <p className="text-xs text-muted-foreground">Utilisation</p>
              </div>
            </div>
            <div className="pt-2 space-y-2">
              <BarRow label="Trips" value={fleet.trips} max={Math.max(fleet.trips, 100)} />
              <BarRow label="Fuel Cost (PKR)" value={fleet.fuelCost} max={Math.max(fleet.fuelCost, 100000)} />
              <BarRow label="Fuel (litres)" value={fleet.fuelLitres} max={Math.max(fleet.fuelLitres, 10000)} />
            </div>
          </CardContent>
        </Card>

        {/* CRM */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4" /> CRM Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold">{crm.leads}</p>
                <p className="text-xs text-muted-foreground">Leads</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{crm.opportunities}</p>
                <p className="text-xs text-muted-foreground">Opps.</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{crm.wonDeals}</p>
                <p className="text-xs text-muted-foreground">Won</p>
              </div>
            </div>
            <div className="space-y-2">
              <BarRow label="Pipeline (PKR)" value={crm.pipelineValue} max={Math.max(crm.pipelineValue, 1000000)} />
              <BarRow label="Qualified leads" value={crm.qualifiedLeads} max={Math.max(crm.leads, 1)} />
              <div className="flex justify-between text-sm pt-1">
                <span className="text-muted-foreground">Conversion rate</span>
                <span className="font-medium">{conversionRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* HRM + Procurement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" /> HR & Procurement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Human Resources
              </p>
              <p className="text-2xl font-bold">{hrm.activeEmployees} <span className="text-sm font-normal text-muted-foreground">active employees</span></p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" /> Procurement
              </p>
              <BarRow label="Pending requisitions" value={procurement.pendingRQs} max={Math.max(procurement.pendingRQs, 10)} />
              <BarRow label="Approved POs" value={procurement.approvedPOs} max={Math.max(procurement.approvedPOs, 10)} />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total PO spend</span>
                <span className="font-medium">PKR {fmt(procurement.totalPOSpend)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Package className="h-3 w-3" /> Inventory
              </p>
              <p className="text-sm"><span className="font-bold">{inventory.itemCount}</span> items catalogued</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
