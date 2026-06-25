"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type PermissionItem = {
  id: string;
  code: string;
  module: string;
  resource: string;
  action: string;
  description: string | null;
};

type PermissionPickerProps = {
  permissions: PermissionItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

const MODULE_LABELS: Record<string, string> = {
  accounts: "Accounts & Finance",
  admin: "Administration",
  crm: "CRM",
  fleet: "Fleet Management",
  hrm: "Human Resources",
  platform: "Platform",
  rm: "Repairs & Maintenance",
  scm: "Supply Chain",
};

export function PermissionPicker({
  permissions,
  selectedIds,
  onChange,
}: PermissionPickerProps) {
  const [search, setSearch] = useState("");
  const query = search.toLowerCase();

  const filtered = query
    ? permissions.filter(
        (p) =>
          p.code.toLowerCase().includes(query) ||
          p.resource.toLowerCase().includes(query) ||
          p.action.toLowerCase().includes(query) ||
          (p.description?.toLowerCase().includes(query) ?? false)
      )
    : permissions;

  // Group by module preserving order
  const grouped = new Map<string, PermissionItem[]>();
  for (const p of filtered) {
    const list = grouped.get(p.module) ?? [];
    list.push(p);
    grouped.set(p.module, list);
  }

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  }

  function selectModule(modulePerms: PermissionItem[]) {
    const ids = modulePerms.map((p) => p.id);
    const next = new Set(selectedIds);
    ids.forEach((id) => next.add(id));
    onChange(Array.from(next));
  }

  function clearModule(modulePerms: PermissionItem[]) {
    const ids = new Set(modulePerms.map((p) => p.id));
    onChange(selectedIds.filter((id) => !ids.has(id)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search permissions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Badge variant="secondary">{selectedIds.length} selected</Badge>
      </div>

      {grouped.size === 0 && (
        <p className="text-sm text-muted-foreground py-4">No permissions match your search.</p>
      )}

      <div className="space-y-4 max-h-96 overflow-y-auto rounded-md border p-4">
        {Array.from(grouped.entries()).map(([module, perms]) => {
          const allSelected = perms.every((p) => selectedIds.includes(p.id));
          const noneSelected = perms.every((p) => !selectedIds.includes(p.id));

          return (
            <div key={module}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">
                  {MODULE_LABELS[module] ?? module}
                </span>
                <div className="flex gap-2">
                  {!allSelected && (
                    <button
                      type="button"
                      onClick={() => selectModule(perms)}
                      className="text-xs text-primary hover:underline"
                    >
                      Select all
                    </button>
                  )}
                  {!noneSelected && (
                    <button
                      type="button"
                      onClick={() => clearModule(perms)}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {perms.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">
                        {p.resource}:{p.action}
                      </span>
                      {p.description && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {p.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
