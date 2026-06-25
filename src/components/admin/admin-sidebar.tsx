"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Settings,
  ClipboardList,
  Building2,
  CreditCard,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPerms: string[];
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    requiredPerms: [],
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    requiredPerms: ["admin:user:view", "admin:user:invite"],
  },
  {
    href: "/admin/roles",
    label: "Roles",
    icon: ShieldCheck,
    requiredPerms: ["admin:role:view", "admin:role:create"],
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    requiredPerms: ["admin:settings:update"],
  },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    icon: ClipboardList,
    requiredPerms: ["admin:audit_log:view"],
  },
];

const PLATFORM_NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/tenants",
    label: "Tenants",
    icon: Building2,
    requiredPerms: ["platform:tenant:view", "platform:tenant:manage"],
  },
  {
    href: "/admin/subscriptions",
    label: "Subscriptions",
    icon: CreditCard,
    requiredPerms: ["platform:subscription:manage"],
  },
];

function isVisible(item: NavItem, permissions: string[]): boolean {
  if (item.requiredPerms.length === 0) return true;
  return item.requiredPerms.some((p) => permissions.includes(p));
}

type AdminSidebarProps = {
  permissions: string[];
};

export function AdminSidebar({ permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const mounted = useRef(false);

  // Read persisted state on mount
  useEffect(() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
    mounted.current = true;
  }, []);

  // Persist on change (skip initial mount)
  useEffect(() => {
    if (!mounted.current) return;
    localStorage.setItem("admin-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  function isActive(href: string): boolean {
    if (href === "/admin/dashboard") return pathname === href;
    return pathname.startsWith(href);
  }

  const visibleItems = NAV_ITEMS.filter((item) =>
    isVisible(item, permissions)
  );
  const visiblePlatformItems = PLATFORM_NAV_ITEMS.filter((item) =>
    isVisible(item, permissions)
  );

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar shrink-0 transition-[width] duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Sidebar header */}
      <div className="flex h-14 items-center border-b px-3 shrink-0">
        {!collapsed && (
          <span className="font-semibold text-sm truncate text-sidebar-foreground">
            Admin Panel
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href as Route}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
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

        {/* Platform section */}
        {visiblePlatformItems.length > 0 && (
          <>
            <div className={cn("my-1", collapsed ? "px-1" : "px-1")}>
              <Separator />
            </div>
            {!collapsed && (
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground">
                Platform
              </p>
            )}
            {visiblePlatformItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
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
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t p-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </aside>
  );
}
