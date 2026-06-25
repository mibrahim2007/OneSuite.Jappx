"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppNavItems } from "@/components/app/app-nav-items";

type AppSidebarProps = {
  permissions: string[];
  enabledModules: string[];
};

export function AppSidebar({ permissions, enabledModules }: AppSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("app-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
    mounted.current = true;
  }, []);

  useEffect(() => {
    if (!mounted.current) return;
    localStorage.setItem("app-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-sidebar shrink-0 transition-[width] duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center border-b px-3 shrink-0">
        {!collapsed && (
          <span className="font-semibold text-sm truncate text-sidebar-foreground">
            Menu
          </span>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">
        <AppNavItems
          permissions={permissions}
          enabledModules={enabledModules}
          pathname={pathname}
          collapsed={collapsed}
        />
      </div>

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
