"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Plus, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { createActivityAction, completeActivityAction } from "@/server/actions/crm/activities";

type Activity = {
  id: string;
  type: "call" | "meeting" | "email" | "task" | "note";
  subject: string;
  notes: string | null;
  relatedEntity: string | null;
  relatedId: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

const TYPE_COLORS: Record<string, string> = {
  call: "bg-blue-100 text-blue-700",
  meeting: "bg-purple-100 text-purple-700",
  email: "bg-yellow-100 text-yellow-700",
  task: "bg-orange-100 text-orange-700",
  note: "bg-gray-100 text-gray-700",
};

type State = { success: true } | { success: false; error: string } | null;

function ActivityDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<State, FormData>(createActivityAction, null);

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success("Activity created.");
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Activity</DialogTitle>
        </DialogHeader>
        <form id="activity-form" action={action} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="act-type">Type</Label>
            <select name="type" id="act-type" className={`w-full ${SELECT_CLASS}`} required>
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="email">Email</option>
              <option value="task">Task</option>
              <option value="note">Note</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-subject">Subject</Label>
            <Input id="act-subject" name="subject" required placeholder="Activity subject" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-due">Due Date/Time</Label>
            <Input id="act-due" name="dueAt" type="datetime-local" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-notes">Notes</Label>
            <textarea
              id="act-notes"
              name="notes"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Additional notes…"
            />
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="activity-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  activities: Activity[];
  canCreate: boolean;
};

export function ActivitiesTable({ activities, canCreate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleComplete(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const res = await completeActivityAction(id);
      if (res.success) { toast.success("Activity completed."); router.refresh(); }
      else toast.error(res.error);
      setPendingId(null);
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canCreate && (
          <Button size="sm" onClick={() => { setDialogKey((k) => k + 1); setOpen(true); }}>
            <Plus className="size-4 mr-1" /> New Activity
          </Button>
        )}
      </div>

      {activities.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No activities" description="Log a call, meeting, or task." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              {canCreate && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[a.type]}`}>
                    {a.type}
                  </span>
                </TableCell>
                <TableCell className="font-medium">
                  {a.subject}
                  {a.notes && <p className="text-xs text-muted-foreground truncate max-w-xs">{a.notes}</p>}
                </TableCell>
                <TableCell className="text-sm">
                  {a.dueAt ? new Date(a.dueAt).toLocaleDateString() : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {a.completedAt ? (
                    <Badge variant="secondary">Done</Badge>
                  ) : (
                    <Badge variant="outline">Open</Badge>
                  )}
                </TableCell>
                {canCreate && (
                  <TableCell>
                    {!a.completedAt && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pendingId === a.id}
                        onClick={() => handleComplete(a.id)}
                        title="Mark complete"
                      >
                        <CheckCircle2 className="size-4 text-green-600" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ActivityDialog key={dialogKey} open={open} onOpenChange={setOpen} />
    </>
  );
}
