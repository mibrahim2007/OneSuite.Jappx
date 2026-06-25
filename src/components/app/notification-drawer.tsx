"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Bell, CheckCheck } from "lucide-react";

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/server/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  linkHref: string | null;
  readAt: Date | null;
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
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function NotificationDrawer({
  unreadCount,
  userId,
}: {
  unreadCount: number;
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [localUnread, setLocalUnread] = useState(unreadCount);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("broadcast", { event: "new_notification" }, (event) => {
        const title =
          (event.payload?.title as string | undefined) ?? "New notification";
        setLocalUnread((prev) => prev + 1);
        toast.info(title);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setItems(
        data.map((n) => ({
          ...n,
          readAt: n.readAt ? new Date(n.readAt) : null,
          createdAt: new Date(n.createdAt),
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) loadNotifications();
  };

  const handleItemClick = (id: string, href: string | null) => {
    startTransition(async () => {
      await markNotificationRead(id);
    });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
    );
    setLocalUnread((c) => Math.max(0, c - 1));
    if (href) {
      setOpen(false);
      router.push(href as Route);
    }
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsRead();
    });
    setItems((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() }))
    );
    setLocalUnread(0);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/* Bell trigger — controlled mode, no SheetTrigger */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleOpenChange(true)}
          aria-label={`Notifications${localUnread > 0 ? `, ${localUnread} unread` : ""}`}
        >
          <Bell className="size-4" aria-hidden="true" />
        </Button>
        {localUnread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground pointer-events-none"
            aria-hidden="true"
          >
            {localUnread > 99 ? "99+" : localUnread}
          </span>
        )}
      </div>

      <SheetContent
        side="right"
        showCloseButton
        className="flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Notifications</SheetTitle>
            {localUnread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="h-7 text-xs gap-1"
              >
                <CheckCheck className="size-3.5" aria-hidden="true" />
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Bell
                className="size-8 text-muted-foreground/50"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                No notifications yet
              </p>
            </div>
          )}

          {!loading &&
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleItemClick(n.id, n.linkHref)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50",
                  !n.readAt && "bg-accent/5"
                )}
                aria-label={`${n.title}${!n.readAt ? " (unread)" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.readAt && (
                    <span
                      className="mt-1.5 size-2 rounded-full bg-accent shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <div className={cn("flex-1 min-w-0", n.readAt && "pl-4")}>
                    <p
                      className={cn(
                        "text-sm truncate",
                        !n.readAt && "font-medium"
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {n.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
