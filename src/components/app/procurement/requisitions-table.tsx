"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateRequisitionStatusAction } from "@/server/actions/procurement/requisitions";
import { RequisitionDialog } from "./requisition-dialog";

type Requisition = {
  id: string;
  reqNo: string;
  reqDate: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "converted";
  notes: string | null;
  requestedBy: string | null;
};

type Item = { id: string; sku: string; name: string };

type Props = {
  requisitions: Requisition[];
  activeItems: Item[];
  canCreate: boolean;
  canApprove: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-800",
  approved:  "bg-green-100 text-green-800",
  rejected:  "bg-red-100 text-red-800",
  converted: "bg-purple-100 text-purple-800",
};

export function RequisitionsTable({ requisitions, activeItems, canCreate, canApprove }: Props) {
  const [dialogKey, setDialogKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function handleStatusChange(
    id: string,
    newStatus: "submitted" | "approved" | "rejected"
  ) {
    setPending((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        const res = await updateRequisitionStatusAction(id, newStatus);
        if (!res.success) toast.error(res.error ?? "Failed.");
      } catch {
        toast.error("Unexpected error.");
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchase Requisitions</h1>
        {canCreate && (
          <button
            onClick={() => { setDialogKey((k) => k + 1); setOpen(true); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Requisition
          </button>
        )}
      </div>

      {requisitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requisitions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Req No</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Notes</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((req) => (
                <tr key={req.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{req.reqNo}</td>
                  <td className="px-4 py-2">{req.reqDate}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[req.status] ?? ""}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{req.notes ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {req.status === "draft" && canCreate && (
                        <button
                          disabled={pending.has(req.id)}
                          onClick={() => handleStatusChange(req.id, "submitted")}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          {pending.has(req.id) ? "…" : "Submit"}
                        </button>
                      )}
                      {req.status === "submitted" && canApprove && (
                        <>
                          <button
                            disabled={pending.has(req.id)}
                            onClick={() => handleStatusChange(req.id, "approved")}
                            className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                          >
                            {pending.has(req.id) ? "…" : "Approve"}
                          </button>
                          <button
                            disabled={pending.has(req.id)}
                            onClick={() => handleStatusChange(req.id, "rejected")}
                            className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {req.status === "approved" && canCreate && (
                        <a
                          href={`/app/procurement/purchase-orders?from_req=${req.id}`}
                          className="rounded px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
                        >
                          Convert to PO →
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RequisitionDialog
        key={dialogKey}
        open={open}
        onClose={() => setOpen(false)}
        activeItems={activeItems}
      />
    </div>
  );
}
