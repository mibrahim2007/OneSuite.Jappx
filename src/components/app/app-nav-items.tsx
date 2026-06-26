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
} from "lucide-react";

import { cn } from "@/lib/utils";

export type AppNavItem = {
  module: string | null;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPerms: string[];
  exactMatch?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    module: null,
    href: "/app/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    requiredPerms: [],
  },
  {
    module: "accounts",
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
    module: "accounts",
    href: "/app/accounts/payments",
    label: "Payments",
    icon: ArrowLeftRight,
    requiredPerms: ["accounts:payment:view"],
  },
  {
    module: "accounts",
    href: "/app/accounts/reports",
    label: "Reports",
    icon: ScrollText,
    requiredPerms: ["accounts:report:view"],
  },
  {
    module: "scm",
    href: "/app/inventory",
    label: "Stock Overview",
    icon: Package,
    requiredPerms: ["scm:inventory:view"],
    exactMatch: true,
  },
  {
    module: "scm",
    href: "/app/inventory/items",
    label: "Items",
    icon: Tag,
    requiredPerms: ["scm:item:view"],
  },
  {
    module: "scm",
    href: "/app/inventory/warehouses",
    label: "Warehouses",
    icon: Warehouse,
    requiredPerms: ["scm:inventory:view"],
  },
  {
    module: "scm",
    href: "/app/inventory/stock-movements",
    label: "Movements",
    icon: ArrowLeftRight,
    requiredPerms: ["scm:inventory:view"],
  },
  {
    module: "scm",
    href: "/app/inventory/ledger",
    label: "Stock Ledger",
    icon: ScrollText,
    requiredPerms: ["scm:inventory:view"],
  },
  {
    module: "scm",
    href: "/app/inventory/settings",
    label: "Inv. Settings",
    icon: Settings2,
    requiredPerms: ["scm:item:view"],
  },
  {
    module: "scm",
    href: "/app/procurement/requisitions",
    label: "Requisitions",
    icon: ClipboardList,
    requiredPerms: ["scm:requisition:view"],
  },
  {
    module: "scm",
    href: "/app/procurement/purchase-orders",
    label: "Purchase Orders",
    icon: ShoppingCart,
    requiredPerms: ["scm:po:view"],
  },
  {
    module: "scm",
    href: "/app/procurement/grns",
    label: "Goods Receipts",
    icon: PackageCheck,
    requiredPerms: ["scm:grn:view"],
  },
  {
    module: "crm",
    href: "/app/crm/companies",
    label: "Companies",
    icon: Building2,
    requiredPerms: ["crm:contact:view"],
  },
  {
    module: "crm",
    href: "/app/crm/contacts",
    label: "Contacts",
    icon: Contact,
    requiredPerms: ["crm:contact:view"],
  },
  {
    module: "crm",
    href: "/app/crm/leads",
    label: "Leads",
    icon: Flame,
    requiredPerms: ["crm:lead:view"],
  },
  {
    module: "crm",
    href: "/app/crm/pipeline",
    label: "Pipeline",
    icon: GitMerge,
    requiredPerms: ["crm:opportunity:view"],
  },
  {
    module: "crm",
    href: "/app/crm/activities",
    label: "Activities",
    icon: CalendarCheck,
    requiredPerms: ["crm:activity:view"],
  },
  {
    module: "crm",
    href: "/app/crm/quotations",
    label: "Quotations",
    icon: FileText,
    requiredPerms: ["crm:quotation:view"],
  },
  {
    module: "hrm",
    href: "/app/hrm",
    label: "HR",
    icon: UserRound,
    requiredPerms: [
      "hrm:employee:view",
      "hrm:attendance:view",
      "hrm:payroll:view",
      "hrm:payslip:view",
    ],
  },
  {
    module: "fleet",
    href: "/app/fleet/vehicles",
    label: "Vehicles",
    icon: Truck,
    requiredPerms: ["fleet:vehicle:view"],
  },
  {
    module: "fleet",
    href: "/app/fleet/drivers",
    label: "Drivers",
    icon: UserRound,
    requiredPerms: ["fleet:driver:view"],
  },
  {
    module: "fleet",
    href: "/app/fleet/trips",
    label: "Trips",
    icon: RouteIcon,
    requiredPerms: ["fleet:trip:view"],
  },
  {
    module: "fleet",
    href: "/app/fleet/fuel-logs",
    label: "Fuel Logs",
    icon: Fuel,
    requiredPerms: ["fleet:fuel:view"],
  },
  {
    module: "fleet",
    href: "/app/fleet/alerts",
    label: "Alerts",
    icon: AlertTriangle,
    requiredPerms: ["fleet:compliance:view"],
  },
  {
    module: "rm",
    href: "/app/rm/assets",
    label: "Assets",
    icon: Wrench,
    requiredPerms: ["rm:asset:view"],
  },
  {
    module: "rm",
    href: "/app/rm/work-orders",
    label: "Work Orders",
    icon: ClipboardList,
    requiredPerms: ["rm:workorder:view"],
  },
  {
    module: "rm",
    href: "/app/rm/pm-schedules",
    label: "PM Schedules",
    icon: CalendarCheck,
    requiredPerms: ["rm:pm:view"],
  },
  {
    module: null,
    href: "/app/approvals",
    label: "Approvals",
    icon: Bell,
    requiredPerms: [],
  },
  {
    module: null,
    href: "/app/activity",
    label: "Activity",
    icon: Activity,
    requiredPerms: [],
  },
];

export function isItemVisible(
  item: AppNavItem,
  permissions: string[],
  enabledModules: string[]
): boolean {
  if (item.module === null) return true;
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

  return (
    <nav className="flex flex-col gap-1 p-2">
      {visible.map((item) => {
        const active =
          item.href === "/app/dashboard" || item.exactMatch
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
    </nav>
  );
}
