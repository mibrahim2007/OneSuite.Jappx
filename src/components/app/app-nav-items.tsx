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
    module: "crm",
    href: "/app/crm",
    label: "CRM",
    icon: Users,
    requiredPerms: [
      "crm:lead:view",
      "crm:contact:view",
      "crm:opportunity:view",
    ],
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
    href: "/app/fleet",
    label: "Fleet",
    icon: Truck,
    requiredPerms: [
      "fleet:vehicle:view",
      "fleet:trip:view",
      "fleet:fuel:view",
    ],
  },
  {
    module: "rm",
    href: "/app/rm",
    label: "Maintenance",
    icon: Wrench,
    requiredPerms: ["rm:asset:view", "rm:workorder:view"],
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
