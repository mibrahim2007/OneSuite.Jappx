import { Activity } from "lucide-react";

export type ActivityEntry = {
  id: string;
  entity: string;
  action: string;
  createdAt: Date;
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type ActivityFeedProps = {
  entries: ActivityEntry[];
};

export function ActivityFeed({ entries }: ActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <Activity className="size-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm font-medium">No recent activity yet.</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Activity will appear here as your team uses the application.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-0 divide-y" aria-label="Recent activity">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 py-3">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"
            aria-hidden="true"
          >
            <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {capitalize(entry.entity)} {entry.action}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {timeAgo(entry.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
