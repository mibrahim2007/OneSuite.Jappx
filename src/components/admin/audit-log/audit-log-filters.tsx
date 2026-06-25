import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/lib/ui-constants";

export type AuditFilters = {
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
};

type AuditLogFiltersProps = {
  current: AuditFilters;
  entityOptions: string[];
  actionOptions: string[];
};

export function AuditLogFilters({
  current,
  entityOptions,
  actionOptions,
}: AuditLogFiltersProps) {
  return (
    <form
      method="get"
      action="/admin/audit-log"
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/40 p-4"
    >
      <div className="space-y-1">
        <Label htmlFor="filter-entity" className="text-xs">
          Entity
        </Label>
        <select
          id="filter-entity"
          name="entity"
          defaultValue={current.entity ?? ""}
          className={SELECT_CLASS}
        >
          <option value="">All entities</option>
          {entityOptions.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-action" className="text-xs">
          Action
        </Label>
        <select
          id="filter-action"
          name="action"
          defaultValue={current.action ?? ""}
          className={SELECT_CLASS}
        >
          <option value="">All actions</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-from" className="text-xs">
          From
        </Label>
        <Input
          id="filter-from"
          type="date"
          name="from"
          defaultValue={current.from ?? ""}
          className="h-8 w-36"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-to" className="text-xs">
          To
        </Label>
        <Input
          id="filter-to"
          type="date"
          name="to"
          defaultValue={current.to ?? ""}
          className="h-8 w-36"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Apply
        </Button>
        <Link
          href="/admin/audit-log"
          className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}
