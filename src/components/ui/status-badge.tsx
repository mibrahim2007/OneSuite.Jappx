import { cn } from "@/lib/utils";

type StatusConfig = {
  label: string;
  colorClass: string;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  // ─── Active / success ─────────────────────────────────────────────────
  active: {
    label: "Active",
    colorClass:
      "bg-[var(--status-active-bg)] text-[var(--status-active-foreground)] border-[var(--status-active)]/20",
  },
  approved: {
    label: "Approved",
    colorClass:
      "bg-[var(--status-active-bg)] text-[var(--status-active-foreground)] border-[var(--status-active)]/20",
  },
  accepted: {
    label: "Accepted",
    colorClass:
      "bg-[var(--status-active-bg)] text-[var(--status-active-foreground)] border-[var(--status-active)]/20",
  },
  completed: {
    label: "Completed",
    colorClass:
      "bg-[var(--status-active-bg)] text-[var(--status-active-foreground)] border-[var(--status-active)]/20",
  },

  // ─── Pending / info ───────────────────────────────────────────────────
  invited: {
    label: "Invited",
    colorClass:
      "bg-[var(--status-pending-bg)] text-[var(--status-pending-foreground)] border-[var(--status-pending)]/20",
  },
  pending: {
    label: "Pending",
    colorClass:
      "bg-[var(--status-pending-bg)] text-[var(--status-pending-foreground)] border-[var(--status-pending)]/20",
  },
  trialing: {
    label: "Trialing",
    colorClass:
      "bg-[var(--status-pending-bg)] text-[var(--status-pending-foreground)] border-[var(--status-pending)]/20",
  },
  in_progress: {
    label: "In Progress",
    colorClass:
      "bg-[var(--status-pending-bg)] text-[var(--status-pending-foreground)] border-[var(--status-pending)]/20",
  },
  scheduled: {
    label: "Scheduled",
    colorClass:
      "bg-[var(--status-pending-bg)] text-[var(--status-pending-foreground)] border-[var(--status-pending)]/20",
  },
  open: {
    label: "Open",
    colorClass:
      "bg-[var(--status-pending-bg)] text-[var(--status-pending-foreground)] border-[var(--status-pending)]/20",
  },

  // ─── Warning ──────────────────────────────────────────────────────────
  suspended: {
    label: "Suspended",
    colorClass:
      "bg-[var(--status-warning-bg)] text-[var(--status-warning-foreground)] border-[var(--status-warning)]/20",
  },
  past_due: {
    label: "Past Due",
    colorClass:
      "bg-[var(--status-warning-bg)] text-[var(--status-warning-foreground)] border-[var(--status-warning)]/20",
  },

  // ─── Inactive / muted ─────────────────────────────────────────────────
  disabled: {
    label: "Disabled",
    colorClass:
      "bg-[var(--status-inactive-bg)] text-[var(--status-inactive-foreground)] border-[var(--status-inactive)]/20",
  },
  closed: {
    label: "Closed",
    colorClass:
      "bg-[var(--status-inactive-bg)] text-[var(--status-inactive-foreground)] border-[var(--status-inactive)]/20",
  },

  // ─── Error / destructive ──────────────────────────────────────────────
  revoked: {
    label: "Revoked",
    colorClass:
      "bg-[var(--status-error-bg)] text-[var(--status-error-foreground)] border-[var(--status-error)]/20",
  },
  canceled: {
    label: "Canceled",
    colorClass:
      "bg-[var(--status-error-bg)] text-[var(--status-error-foreground)] border-[var(--status-error)]/20",
  },
  cancelled: {
    label: "Cancelled",
    colorClass:
      "bg-[var(--status-error-bg)] text-[var(--status-error-foreground)] border-[var(--status-error)]/20",
  },
  expired: {
    label: "Expired",
    colorClass:
      "bg-[var(--status-error-bg)] text-[var(--status-error-foreground)] border-[var(--status-error)]/20",
  },
  rejected: {
    label: "Rejected",
    colorClass:
      "bg-[var(--status-error-bg)] text-[var(--status-error-foreground)] border-[var(--status-error)]/20",
  },
};

type StatusBadgeProps = {
  status: string;
  className?: string;
  label?: string;
};

export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    colorClass:
      "bg-[var(--status-inactive-bg)] text-[var(--status-inactive-foreground)] border-[var(--status-inactive)]/20",
  };

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        config.colorClass,
        className
      )}
    >
      {label ?? config.label}
    </span>
  );
}
