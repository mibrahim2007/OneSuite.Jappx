"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Activity } from "lucide-react";

import { SELECT_CLASS } from "@/lib/ui-constants";
import { EmptyState } from "@/components/ui/empty-state";

type Entry = {
  id: string;
  entity: string;
  entityId: string | null;
  action: string;
  createdAt: Date;
  userName: string | null;
};

type Props = {
  entries: Entry[];
  entityTypes: string[];
  currentEntity: string;
  currentAction: string;
};

const ACTION_COLORS: Record<string, string> = {
  created: "bg-green-100 text-green-800",
  updated: "bg-blue-100 text-blue-800",
  deleted: "bg-red-100 text-red-800",
};

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ActivityTimeline({
  entries,
  entityTypes,
  currentEntity,
  currentAction,
}: Props) {
  const router = useRouter();

  function applyFilter(entity: string, action: string) {
    const params = new URLSearchParams();
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);
    const qs = params.toString();
    router.push((`/app/activity${qs ? `?${qs}` : ""}`) as Route);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          className={SELECT_CLASS}
          value={currentEntity}
          onChange={(e) => applyFilter(e.target.value, currentAction)}
          aria-label="Filter by entity type"
        >
          <option value="">All entity types</option>
          {entityTypes.map((et) => (
            <option key={et} value={et}>
              {capitalize(et.replace(/_/g, " "))}
            </option>
          ))}
        </select>

        <select
          className={SELECT_CLASS}
          value={currentAction}
          onChange={(e) => applyFilter(currentEntity, e.target.value)}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Actions taken in your workspace will appear here."
        />
      ) : (
        <div className="rounded-md border divide-y">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">
                    {entry.userName ?? "System"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {capitalize(entry.action)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {capitalize(entry.entity.replace(/_/g, " "))}
                  </span>
                  {entry.entityId && (
                    <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                      {entry.entityId.slice(0, 8)}…
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {timeAgo(entry.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
