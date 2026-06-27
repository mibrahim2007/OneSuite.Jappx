"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  LayoutDashboard,
  BookOpen,
  Package,
  Tag,
  Warehouse,
  ArrowLeftRight,
  ScrollText,
  Settings2,
  Users,
  UserRound,
  Truck,
  Wrench,
  ClipboardList,
  ShoppingCart,
  PackageCheck,
  Building2,
  Contact,
  Flame,
  GitMerge,
  CalendarCheck,
  FileText,
  Activity,
  Bell,
  Route as RouteIcon,
  Fuel,
  AlertTriangle,
  BarChart3,
  MapPin,
  TrendingUp,
  Globe,
  Landmark,
  DollarSign,
  Briefcase,
  Video,
  Star,
  Ticket as TicketIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type AppNavItem = {
  module: string | null;   // subscription visibility gate (null = always included)
  section: string | null;  // display group in sidebar  (null = top, ungrouped)
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPerms: string[];
  exactMatch?: boolean;
};

// Maps section key → human label shown in the sidebar
const SECTION_LABELS: Record<string, string> = {
  accounts: "Finance",
  scm:      "Supply Chain",
  crm:      "CRM & Sales",
  hrm:      "People",
  fleet:    "Fleet",
  rm:       "Maintenance",
  workspace: "Workspace",
  settings:  "Settings",
};

// Controls the render order of sections
const SECTION_ORDER = [
  null,
  "accounts",
  "scm",
  "crm",
  "hrm",
  "fleet",
  "rm",
  "workspace",
  "settings",
] as const;

export const APP_NAV_ITEMS: AppNavItem[] = [
  // ── Ungrouped top ────────────────────────────────────────────────────────
  {
    module: null, section: null,
    href: "/app/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    requiredPerms: [],
    exactMatch: true,
  },
  {
    module: null, section: null,
    href: "/app/analytics",
    label: "Analytics",
    icon: BarChart3,
    requiredPerms: ["accounts:report:view"],
  },

  // ── Finance ──────────────────────────────────────────────────────────────
  {
    module: "accounts", section: "accounts",
    href: "/app/accounts",
    label: "Accounts",
    icon: BookOpen,
    requiredPerms: [
      "accounts:coa:view",
      "accounts:invoice:view",
      "accounts:report:view",
      "accounts:contact:view",
      "accounts:bill:view",
    ],
  },
  {
    module: "accounts", section: "accounts",
    href: "/app/accounts/payments",
    label: "Payments",
    icon: ArrowLeftRight,
    requiredPerms: ["accounts:payment:view"],
  },
  {
    module: "accounts", section: "accounts",
    href: "/app/accounts/reports",
    label: "Reports",
    icon: ScrollText,
    requiredPerms: ["accounts:report:view"],
  },
  {
    module: "accounts", section: "accounts",
    href: "/app/accounts/cost-dashboard",
    label: "Cost Dashboard",
    icon: TrendingUp,
    requiredPerms: ["accounts:report:view"],
  },
  {
    module: "accounts", section: "accounts",
    href: "/app/accounts/budgets",
    label: "Budgets",
    icon: BarChart3,
    requiredPerms: ["accounts:report:view"],
  },
  {
    module: "accounts", section: "accounts",
    href: "/app/accounts/budget-vs-actual",
    label: "Budget vs Actual",
    icon: TrendingUp,
    requiredPerms: ["accounts:report:view"],
  },
  {
    module: "accounts", section: "accounts",
    href: "/app/accounts/department-budgets",
    label: "Dept. Budgets",
    icon: BarChart3,
    requiredPerms: ["accounts:report:view"],
  },
  {
    module: "accounts", section: "accounts",
    href: "/app/accounts/bank-reconciliation",
    label: "Bank Reconciliation",
    icon: Landmark,
    requiredPerms: ["accounts:journal:view"],
  },
  {
    module: "accounts", section: "accounts",
    href: "/app/accounts/forex-gains-losses",
    label: "Forex Gains/Losses",
    icon: DollarSign,
    requiredPerms: ["accounts:reports:view"],
  },

  // ── Supply Chain ─────────────────────────────────────────────────────────
  {
    module: "scm", section: "scm",
    href: "/app/inventory",
    label: "Stock Overview",
    icon: Package,
    requiredPerms: ["scm:inventory:view"],
    exactMatch: true,
  },
  {
    module: "scm", section: "scm",
    href: "/app/inventory/items",
    label: "Items",
    icon: Tag,
    requiredPerms: ["scm:item:view"],
  },
  {
    module: "scm", section: "scm",
    href: "/app/inventory/warehouses",
    label: "Warehouses",
    icon: Warehouse,
    requiredPerms: ["scm:inventory:view"],
  },
  {
    module: "scm", section: "scm",
    href: "/app/inventory/stock-movements",
    label: "Movements",
    icon: ArrowLeftRight,
    requiredPerms: ["scm:inventory:view"],
  },
  {
    module: "scm", section: "scm",
    href: "/app/inventory/ledger",
    label: "Stock Ledger",
    icon: ScrollText,
    requiredPerms: ["scm:inventory:view"],
  },
  {
    module: "scm", section: "scm",
    href: "/app/inventory/settings",
    label: "Inv. Settings",
    icon: Settings2,
    requiredPerms: ["scm:item:view"],
  },
  {
    module: "scm", section: "scm",
    href: "/app/procurement/requisitions",
    label: "Requisitions",
    icon: ClipboardList,
    requiredPerms: ["scm:requisition:view"],
  },
  {
    module: "scm", section: "scm",
    href: "/app/procurement/purchase-orders",
    label: "Purchase Orders",
    icon: ShoppingCart,
    requiredPerms: ["scm:po:view"],
  },
  {
    module: "scm", section: "scm",
    href: "/app/procurement/grns",
    label: "Goods Receipts",
    icon: PackageCheck,
    requiredPerms: ["scm:grn:view"],
  },

  // ── CRM & Sales ──────────────────────────────────────────────────────────
  {
    module: "crm", section: "crm",
    href: "/app/crm/companies",
    label: "Companies",
    icon: Building2,
    requiredPerms: ["crm:contact:view"],
  },
  {
    module: "crm", section: "crm",
    href: "/app/crm/contacts",
    label: "Contacts",
    icon: Contact,
    requiredPerms: ["crm:contact:view"],
  },
  {
    module: "crm", section: "crm",
    href: "/app/crm/leads",
    label: "Leads",
    icon: Flame,
    requiredPerms: ["crm:lead:view"],
  },
  {
    module: "crm", section: "crm",
    href: "/app/crm/pipeline",
    label: "Pipeline",
    icon: GitMerge,
    requiredPerms: ["crm:opportunity:view"],
  },
  {
    module: "crm", section: "crm",
    href: "/app/crm/activities",
    label: "Activities",
    icon: CalendarCheck,
    requiredPerms: ["crm:activity:view"],
  },
  {
    module: "crm", section: "crm",
    href: "/app/crm/quotations",
    label: "Quotations",
    icon: FileText,
    requiredPerms: ["crm:quotation:view"],
  },
  {
    module: "crm", section: "crm",
    href: "/app/crm/campaigns",
    label: "Campaigns",
    icon: Activity,
    requiredPerms: ["crm:lead:view"],
  },
  {
    module: "crm", section: "crm",
    href: "/app/crm/tickets",
    label: "Support Tickets",
    icon: TicketIcon,
    requiredPerms: ["crm:lead:view"],
  },

  // ── People ────────────────────────────────────────────────────────────────
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/employees",
    label: "Employees",
    icon: UserRound,
    requiredPerms: ["hrm:employee:view"],
  },
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/departments",
    label: "Departments",
    icon: Building2,
    requiredPerms: ["hrm:employee:view"],
  },
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/attendance",
    label: "Attendance",
    icon: CalendarCheck,
    requiredPerms: ["hrm:attendance:view"],
  },
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/leave",
    label: "Leave",
    icon: Users,
    requiredPerms: ["hrm:leave:view"],
  },
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/payroll/runs",
    label: "Payroll Runs",
    icon: ScrollText,
    requiredPerms: ["hrm:payroll:view"],
  },
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/payroll/structures",
    label: "Salary Structures",
    icon: Settings2,
    requiredPerms: ["hrm:payroll:view"],
  },
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/payroll/my-payslips",
    label: "My Payslips",
    icon: FileText,
    requiredPerms: ["hrm:payslip:view"],
  },
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/recruitment/jobs",
    label: "Jobs",
    icon: Briefcase,
    requiredPerms: ["hrm:recruit:view"],
  },
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/recruitment/interviews",
    label: "Interviews",
    icon: Video,
    requiredPerms: ["hrm:recruit:view"],
  },
  {
    module: "hrm", section: "hrm",
    href: "/app/hrm/appraisals",
    label: "Appraisals",
    icon: Star,
    requiredPerms: ["hrm:appraisal:view", "hrm:appraisal:self"],
  },

  // ── Fleet ─────────────────────────────────────────────────────────────────
  {
    module: "fleet", section: "fleet",
    href: "/app/fleet/vehicles",
    label: "Vehicles",
    icon: Truck,
    requiredPerms: ["fleet:vehicle:view"],
  },
  {
    module: "fleet", section: "fleet",
    href: "/app/fleet/drivers",
    label: "Drivers",
    icon: UserRound,
    requiredPerms: ["fleet:driver:view"],
  },
  {
    module: "fleet", section: "fleet",
    href: "/app/fleet/trips",
    label: "Trips",
    icon: RouteIcon,
    requiredPerms: ["fleet:trip:view"],
  },
  {
    module: "fleet", section: "fleet",
    href: "/app/fleet/fuel-logs",
    label: "Fuel Logs",
    icon: Fuel,
    requiredPerms: ["fleet:fuel:view"],
  },
  {
    module: "fleet", section: "fleet",
    href: "/app/fleet/alerts",
    label: "Alerts",
    icon: AlertTriangle,
    requiredPerms: ["fleet:compliance:view"],
  },
  {
    module: "fleet", section: "fleet",
    href: "/app/fleet/maintenance",
    label: "Fleet Maintenance",
    icon: BarChart3,
    requiredPerms: ["fleet:vehicle:view"],
  },
  {
    module: "fleet", section: "fleet",
    href: "/app/fleet/gl-posting",
    label: "GL Posting",
    icon: BookOpen,
    requiredPerms: ["accounts:journal:create"],
  },
  {
    module: "fleet", section: "fleet",
    href: "/app/fleet/tracking",
    label: "Live Tracking",
    icon: MapPin,
    requiredPerms: ["fleet:tracking:view"],
  },
  {
    module: "fleet", section: "fleet",
    href: "/app/fleet/geofences",
    label: "Geofences",
    icon: AlertTriangle,
    requiredPerms: ["fleet:tracking:view"],
  },

  // ── Maintenance ───────────────────────────────────────────────────────────
  {
    module: "rm", section: "rm",
    href: "/app/rm/assets",
    label: "Assets",
    icon: Wrench,
    requiredPerms: ["rm:asset:view"],
  },
  {
    module: "rm", section: "rm",
    href: "/app/rm/work-orders",
    label: "Work Orders",
    icon: ClipboardList,
    requiredPerms: ["rm:workorder:view"],
  },
  {
    module: "rm", section: "rm",
    href: "/app/rm/pm-schedules",
    label: "PM Schedules",
    icon: CalendarCheck,
    requiredPerms: ["rm:pm:view"],
  },

  // ── Workspace (global, bottom) ────────────────────────────────────────────
  {
    module: null, section: "workspace",
    href: "/app/approvals",
    label: "Approvals",
    icon: Bell,
    requiredPerms: [],
  },
  {
    module: null, section: "workspace",
    href: "/app/activity",
    label: "Activity",
    icon: Activity,
    requiredPerms: [],
  },

  // ── Settings (admin-only, bottom) ─────────────────────────────────────────
  {
    module: null, section: "settings",
    href: "/app/settings/currencies",
    label: "Currencies",
    icon: Globe,
    requiredPerms: ["admin:settings:view"],
  },
  {
    module: null, section: "settings",
    href: "/app/settings/gl-mappings",
    label: "GL Mappings",
    icon: MapPin,
    requiredPerms: ["admin:settings:view"],
  },
];

export function isItemVisible(
  item: AppNavItem,
  permissions: string[],
  enabledModules: string[]
): boolean {
  if (item.module === null) return item.requiredPerms.length === 0
    ? true
    : item.requiredPerms.some((p) => permissions.includes(p));
  if (!enabledModules.includes(item.module)) return false;
  if (item.requiredPerms.length === 0) return true;
  return item.requiredPerms.some((p) => permissions.includes(p));
}

type AppNavItemsProps = {
  permissions: string[];
  enabledModules: string[];
  pathname: string;
  collapsed?: boolean;
  onItemClick?: () => void;
};

export function AppNavItems({
  permissions,
  enabledModules,
  pathname,
  collapsed = false,
  onItemClick,
}: AppNavItemsProps) {
  const visible = APP_NAV_ITEMS.filter((item) =>
    isItemVisible(item, permissions, enabledModules)
  );

  // Bucket items by section, preserving SECTION_ORDER
  const grouped = new Map<string | null, AppNavItem[]>(
    SECTION_ORDER.map((s) => [s, []])
  );
  for (const item of visible) {
    grouped.get(item.section)?.push(item);
  }

  return (
    <nav className="flex flex-col p-2" aria-label="Main navigation">
      {SECTION_ORDER.map((section) => {
        const items = grouped.get(section) ?? [];
        if (items.length === 0) return null;

        const label = section ? SECTION_LABELS[section] : null;

        return (
          <div key={section ?? "_top"} className={section ? "mt-1" : undefined}>
            {/* Expanded: text header; Collapsed: thin divider */}
            {label && !collapsed && (
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                {label}
              </p>
            )}
            {label && collapsed && (
              <div className="mx-2 mt-3 mb-1 border-t border-border" />
            )}

            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active =
                  item.exactMatch
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    onClick={onItemClick}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
