"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock } from "lucide-react";

import { decideApprovalStepAction } from "@/server/actions/approvals";

type PendingRow = {
  stepId: string;
  stepNo: number;
  requestId: string;
  entity: string;
  entityId: string;
  requestedBy: string | null;
  createdAt: Date;
};

const ENTITY_LABEL: Record<string, string> = {
  requisition: "Purchase Requisition",
  purchase_order: "Purchase Order",
};

const ENTITY_HREF: Record<string, (id: string) => string> = {
  requisition: (id) => `/app/procurement/requisitions`,
  purchase_order: (id) => `/app/procurement/purchase-orders`,
};

type Props = { pending: PendingRow[] };

export function ApprovalsInbox({ pending }: Props) {
  const [isPending, startTransition] = useTransition();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [rejectStepId, setRejectStepId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  function handleApprove(stepId: string) {
    setProcessingIds((prev) => new Set(prev).add(stepId));
    startTransition(async () => {
      try {
        const result = await decideApprovalStepAction(stepId, "approved");
        if (result.success) {
          toast.success("Approved successfully.");
        } else {
          toast.error(result.error ?? "Failed to approve.");
        }
      } catch {
        toast.error("An unexpected error occurred.");
      } finally {
        setProcessingIds((prev) => {
          const n = new Set(prev);
          n.delete(stepId);
          return n;
        });
      }
    });
  }

  function handleRejectSubmit() {
    if (!rejectStepId) return;
    const stepId = rejectStepId;
    setProcessingIds((prev) => new Set(prev).add(stepId));
    setRejectStepId(null);
    const comment = rejectComment.trim();
    setRejectComment("");
    startTransition(async () => {
      try {
        const result = await decideApprovalStepAction(stepId, "rejected", comment || undefined);
        if (result.success) {
          toast.success("Rejected.");
        } else {
          toast.error(result.error ?? "Failed to reject.");
        }
      } catch {
        toast.error("An unexpected error occurred.");
      } finally {
        setProcessingIds((prev) => {
          const n = new Set(prev);
          n.delete(stepId);
          return n;
        });
      }
    });
  }

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CheckCircle className="size-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">All caught up!</p>
        <p className="text-muted-foreground text-sm mt-1">No pending approvals for you right now.</p>
      </div>
    );
  }

  return (
    <>
      {/* Reject dialog */}
      {rejectStepId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Reject — Add Comment</h2>
            <textarea
              className="w-full border rounded-md p-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Reason for rejection (optional)"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setRejectStepId(null); setRejectComment(""); }}
                className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Document Type</th>
              <th className="text-left px-4 py-3 font-medium">Requested</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pending.map((row) => {
              const isProcessing = processingIds.has(row.stepId);
              const label = ENTITY_LABEL[row.entity] ?? row.entity;
              const hrefFn = ENTITY_HREF[row.entity];
              const href = hrefFn ? hrefFn(row.entityId) : "#";

              return (
                <tr key={row.stepId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-muted-foreground shrink-0" />
                      <div>
                        <Link
                          href={href as Route}
                          className="font-medium hover:underline"
                        >
                          {label}
                        </Link>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          Step {row.stepNo}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isProcessing || isPending}
                        onClick={() => handleApprove(row.stepId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="size-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing || isPending}
                        onClick={() => setRejectStepId(row.stepId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="size-3.5" />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
