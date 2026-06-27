"use client";

import { startTransition } from "react";
import { Check, ChevronDown, Building2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchTenantAction } from "@/server/actions/tenant";

export type OrgMembership = {
  tenantId: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  roleName: string | null;
};

type OrgSwitcherProps = {
  memberships: OrgMembership[];
  currentTenantId: string;
};

function OrgAvatar({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        width={24}
        height={24}
        className="h-6 w-6 rounded object-cover"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function OrgSwitcher({ memberships, currentTenantId }: OrgSwitcherProps) {
  const current = memberships.find((m) => m.tenantId === currentTenantId);
  const currentName = current?.tenantName ?? "Organization";

  function handleSwitch(tenantId: string) {
    startTransition(async () => {
      await switchTenantAction(tenantId);
    });
  }

  if (memberships.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{currentName}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span>{currentName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.tenantId}
            onClick={() => {
              if (m.tenantId !== currentTenantId) handleSwitch(m.tenantId);
            }}
            className="flex items-center gap-2.5"
          >
            <OrgAvatar name={m.tenantName} logoUrl={m.tenantLogoUrl} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{m.tenantName}</span>
              {m.roleName && (
                <span className="truncate text-xs text-muted-foreground">
                  {m.roleName}
                </span>
              )}
            </div>
            {m.tenantId === currentTenantId && (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
