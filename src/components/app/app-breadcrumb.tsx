"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  // Finance
  accounts:            "Finance",
  invoices:            "Invoices",
  bills:               "Bills",
  contacts:            "Contacts",
  payments:            "Payments",
  reports:             "Reports",
  "cost-dashboard":    "Cost Dashboard",
  budgets:             "Budgets",
  "budget-vs-actual":  "Budget vs Actual",
  "department-budgets":"Dept. Budgets",
  "bank-reconciliation":"Bank Reconciliation",
  "chart-of-accounts": "Chart of Accounts",
  "fiscal-periods":    "Fiscal Periods",
  "journal-entries":   "Journal Entries",
  "forex-gains-losses":"Forex Gains/Losses",
  "general-ledger":    "General Ledger",
  // Fleet
  fleet:               "Fleet",
  vehicles:            "Vehicles",
  drivers:             "Drivers",
  trips:               "Trips",
  "fuel-logs":         "Fuel Logs",
  alerts:              "Alerts",
  maintenance:         "Fleet Maintenance",
  "gl-posting":        "GL Posting",
  geofences:           "Geofences",
  tracking:            "Tracking",
  devices:             "Devices",
  // People
  hrm:                 "People",
  employees:           "Employees",
  departments:         "Departments",
  attendance:          "Attendance",
  leave:               "Leave",
  payroll:             "Payroll",
  appraisals:          "Appraisals",
  "my-payslips":       "My Payslips",
  runs:                "Payroll Runs",
  structures:          "Salary Structures",
  recruitment:         "Recruitment",
  interviews:          "Interviews",
  jobs:                "Jobs",
  // CRM
  crm:                 "CRM & Sales",
  companies:           "Companies",
  leads:               "Leads",
  pipeline:            "Pipeline",
  activities:          "Activities",
  quotations:          "Quotations",
  campaigns:           "Campaigns",
  tickets:             "Support Tickets",
  // Inventory
  inventory:           "Inventory",
  items:               "Items",
  warehouses:          "Warehouses",
  "stock-movements":   "Stock Movements",
  ledger:              "Inventory Ledger",
  // Procurement
  procurement:         "Procurement",
  "purchase-orders":   "Purchase Orders",
  requisitions:        "Requisitions",
  grns:                "GRNs",
  // Maintenance
  rm:                  "Maintenance",
  assets:              "Assets",
  "work-orders":       "Work Orders",
  "pm-schedules":      "PM Schedules",
  // Workspace / Settings
  approvals:           "Approvals",
  activity:            "Activity",
  settings:            "Settings",
  currencies:          "Currencies",
  "gl-mappings":       "GL Mappings",
  security:            "Security",
  "setup-mfa":         "Set Up MFA",
  // Misc
  scm:                 "Supply Chain",
  analytics:           "Analytics",
  new:                 "New",
};

const SINGULAR: Record<string, string> = {
  invoices:         "Invoice",
  bills:            "Bill",
  contacts:         "Contact",
  vehicles:         "Vehicle",
  employees:        "Employee",
  leads:            "Lead",
  quotations:       "Quotation",
  tickets:          "Ticket",
  "work-orders":    "Work Order",
  budgets:          "Budget",
  runs:             "Payroll Run",
  jobs:             "Job",
  appraisals:       "Appraisal",
  drivers:          "Driver",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toLabel(seg: string, parentSeg?: string): string {
  if (UUID_RE.test(seg)) {
    return parentSeg ? (SINGULAR[parentSeg] ?? "Detail") : "Detail";
  }
  return (
    LABELS[seg] ??
    seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

type Crumb = { label: string; href: string };

export function AppBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Only render when there are at least 2 segments after "app"
  // e.g. /app/accounts/invoices (3 total) → show
  //      /app/dashboard (2 total) → hide
  if (segments.length <= 2) return null;

  const crumbs: Crumb[] = [{ label: "Home", href: "/app/dashboard" }];

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i] ?? "";
    const parent = segments[i - 1];
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = toLabel(seg, parent);
    crumbs.push({ label, href });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 px-6 pt-4 pb-1 text-sm text-muted-foreground overflow-x-auto"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1 shrink-0">
            {i > 0 && (
              <ChevronRight
                className="size-3.5 opacity-40 shrink-0"
                aria-hidden="true"
              />
            )}
            {isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href as Route}
                className="hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
