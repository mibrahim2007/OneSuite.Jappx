"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Settings, LogOut, Shield } from "lucide-react";

import { OrgSwitcher } from "@/components/app/org-switcher";
import type { OrgMembership } from "@/components/app/org-switcher";
import { CommandPalette } from "@/components/app/command-palette";
import { NotificationDrawer } from "@/components/app/notification-drawer";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const ADMIN_NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Users", href: "/admin/users" },
  { label: "Roles", href: "/admin/roles" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Audit Log", href: "/admin/audit-log" },
  { label: "Tenants", href: "/admin/tenants" },
  { label: "Subscriptions", href: "/admin/subscriptions" },
];

type AdminHeaderProps = {
  tenantName: string;
  tenantLogoUrl: string | null;
  userFullName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  memberships: OrgMembership[];
  currentTenantId: string;
  unreadCount: number;
  userId: string;
};

function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminHeader({
  tenantName,
  tenantLogoUrl,
  userFullName,
  userEmail,
  userAvatarUrl,
  memberships,
  currentTenantId,
  unreadCount,
  userId,
}: AdminHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 shrink-0">
      {/* Left: tenant identity */}
      <div className="flex items-center gap-2 min-w-0 mr-4">
        {tenantLogoUrl ? (
          <img
            src={tenantLogoUrl}
            alt={tenantName}
            width={24}
            height={24}
            className="h-6 w-6 rounded object-cover"
          />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary shrink-0">
            {tenantName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="font-semibold text-sm truncate max-w-[140px]">
          {tenantName}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <OrgSwitcher
          memberships={memberships}
          currentTenantId={currentTenantId}
        />

        <CommandPalette navItems={ADMIN_NAV_ITEMS} />

        <NotificationDrawer unreadCount={unreadCount} userId={userId} />

        {/* Profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="User menu"
          >
            <Avatar size="sm">
              {userAvatarUrl && (
                <AvatarImage src={userAvatarUrl} alt={userFullName} />
              )}
              <AvatarFallback>{getInitials(userFullName)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            {/* User identity header */}
            <div className="px-3 py-2">
              <p className="text-sm font-medium truncate">{userFullName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => router.push("/app/settings/security" as Route)}
            >
              <Settings className="mr-2 size-4" aria-hidden="true" />
              Profile &amp; Settings
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() => router.push("/app/settings/security" as Route)}
            >
              <Shield className="mr-2 size-4" aria-hidden="true" />
              Security
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => {
                window.location.href = "/api/auth/logout";
              }}
            >
              <LogOut className="mr-2 size-4" aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
