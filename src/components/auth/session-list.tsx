"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  revokeSessionAction,
  revokeAllOtherSessionsAction,
} from "@/server/actions/sessions";

export type SessionDisplay = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function SessionList({ sessions }: { sessions: SessionDisplay[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRevoke(sessionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeSessionAction(sessionId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRevokeAll() {
    setError(null);
    startTransition(async () => {
      const result = await revokeAllOtherSessionsAction();
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="divide-y divide-border rounded-md border">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between gap-4 p-4"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <span
                  className="truncate max-w-xs"
                  title={session.userAgent ?? undefined}
                >
                  {session.userAgent
                    ? session.userAgent.slice(0, 60) +
                      (session.userAgent.length > 60 ? "…" : "")
                    : "Unknown device"}
                </span>
                {session.isCurrent && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Current session
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {session.ipAddress ?? "Unknown IP"} · Signed in{" "}
                {formatDate(session.createdAt)}
              </p>
            </div>

            {!session.isCurrent && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleRevoke(session.id)}
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>

      {otherSessions.length > 0 && (
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={handleRevokeAll}
        >
          Revoke all other sessions
        </Button>
      )}
    </div>
  );
}
