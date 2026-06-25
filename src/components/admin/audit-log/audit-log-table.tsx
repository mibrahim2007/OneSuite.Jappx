import Link from "next/link";
import { Clock } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditFilters } from "./audit-log-filters";

export type AuditLogRow = {
  id: string;
  entity: string;
  entityId: string | null;
  action: string;
  changes: unknown;
  ipAddress: string | null;
  createdAt: Date;
  userFullName: string | null;
};

type AuditLogTableProps = {
  rows: AuditLogRow[];
  page: number;
  totalPages: number;
  total: number;
  filters: AuditFilters;
};

function buildUrl(page: number, filters: AuditFilters) {
  const query: Record<string, string> = { page: String(page) };
  if (filters.entity) query.entity = filters.entity;
  if (filters.action) query.action = filters.action;
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  return { pathname: "/admin/audit-log", query };
}

function formatTimestamp(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function AuditLogTable({
  rows,
  page,
  totalPages,
  total,
  filters,
}: AuditLogTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No audit events found"
        description="Try adjusting your filters or broadening the date range."
      />
    );
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Changes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {formatTimestamp(row.createdAt)}
              </TableCell>

              <TableCell className="text-sm">
                {row.userFullName ?? (
                  <span className="text-muted-foreground">System</span>
                )}
              </TableCell>

              <TableCell>
                <p className="text-sm font-medium">{row.entity}</p>
                {row.entityId && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.entityId.slice(0, 8)}…
                  </p>
                )}
              </TableCell>

              <TableCell>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {row.action}
                </code>
              </TableCell>

              <TableCell>
                {row.changes ? (
                  <details>
                    <summary className="cursor-pointer text-xs text-primary hover:underline">
                      View
                    </summary>
                    <pre className="mt-1 max-h-40 max-w-xs overflow-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(
                        row.changes as Record<string, unknown>,
                        null,
                        2
                      )}
                    </pre>
                  </details>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {total} event{total !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-4">
          {page > 1 && (
            <Link
              href={buildUrl(page - 1, filters)}
              className="text-sm hover:underline"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildUrl(page + 1, filters)}
              className="text-sm hover:underline"
            >
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
