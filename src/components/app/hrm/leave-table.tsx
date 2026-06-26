"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SELECT_CLASS } from "@/lib/ui-constants";
import {
  createLeaveRequestAction,
  decideLeaveRequestAction,
  cancelLeaveRequestAction,
} from "@/server/actions/hrm/leave";
import type { LeaveType } from "@/lib/db/schema";

type EmpRow = { id: string; empCode: string; fullName: string };

type RequestRow = {
  id: string;
  employeeId: string;
  leaveTypeId: string | null;
  startDate: string;
  endDate: string;
  days: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy: string | null;
  createdAt: Date;
  employeeName: string | null;
  leaveTypeName: string | null;
};

type Props = {
  requests: RequestRow[];
  employees: EmpRow[];
  leaveTypes: LeaveType[];
  canRequest: boolean;
  canApprove: boolean;
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

function RequestDialog({
  open, dialogKey, employees, leaveTypes, onClose,
}: {
  open: boolean;
  dialogKey: number;
  employees: EmpRow[];
  leaveTypes: LeaveType[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createLeaveRequestAction, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) { toast.success("Leave request submitted."); onClose(); }
    else toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Submit Leave Request</DialogTitle></DialogHeader>
        <form key={dialogKey} action={formAction} className="space-y-3">
          <div>
            <Label htmlFor="lr-emp">Employee *</Label>
            <select id="lr-emp" name="employeeId" required className={SELECT_CLASS}>
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.empCode} — {e.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="lr-type">Leave Type</Label>
            <select id="lr-type" name="leaveTypeId" className={SELECT_CLASS}>
              <option value="">— select —</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>{lt.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lr-start">Start Date *</Label>
              <Input id="lr-start" name="startDate" type="date" required />
            </div>
            <div>
              <Label htmlFor="lr-end">End Date *</Label>
              <Input id="lr-end" name="endDate" type="date" required />
            </div>
          </div>
          <div>
            <Label htmlFor="lr-days">Days *</Label>
            <Input id="lr-days" name="days" type="number" step="0.5" min="0.5" required />
          </div>
          <div>
            <Label htmlFor="lr-reason">Reason</Label>
            <Input id="lr-reason" name="reason" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LeaveTable({ requests, employees, leaveTypes, canRequest, canApprove }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function openCreate() {
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function decide(id: string, decision: "approved" | "rejected") {
    setPendingIds((s) => new Set(s).add(id));
    startTransition(async () => {
      const result = await decideLeaveRequestAction(id, decision);
      setPendingIds((s) => { const n = new Set(s); n.delete(id); return n; });
      if (!result?.success) toast.error(result?.error ?? "Failed.");
      else toast.success(decision === "approved" ? "Approved." : "Rejected.");
    });
  }

  function cancel(id: string) {
    setPendingIds((s) => new Set(s).add(id));
    startTransition(async () => {
      const result = await cancelLeaveRequestAction(id);
      setPendingIds((s) => { const n = new Set(s); n.delete(id); return n; });
      if (!result?.success) toast.error(result?.error ?? "Failed.");
      else toast.success("Cancelled.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leave Requests</h1>
        {canRequest && (
          <Button size="sm" onClick={openCreate}>Submit Request</Button>
        )}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No leave requests"
          description="No leave requests have been submitted yet."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              {(canApprove || canRequest) && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => {
              const isBusy = pendingIds.has(r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.employeeName ?? r.employeeId}</TableCell>
                  <TableCell>{r.leaveTypeName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.startDate}</TableCell>
                  <TableCell className="text-sm">{r.endDate}</TableCell>
                  <TableCell>{r.days}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE[r.status] ?? ""}>{r.status}</Badge>
                  </TableCell>
                  {(canApprove || canRequest) && (
                    <TableCell>
                      <div className="flex gap-1">
                        {canApprove && r.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => decide(r.id, "approved")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => decide(r.id, "rejected")}>
                              Reject
                            </Button>
                          </>
                        )}
                        {canRequest && r.status === "pending" && (
                          <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => cancel(r.id)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <RequestDialog
        open={dialogOpen}
        dialogKey={dialogKey}
        employees={employees}
        leaveTypes={leaveTypes}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
