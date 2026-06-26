"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";

import { updatePoStatusAction } from "@/server/actions/procurement/purchase-orders";
import { PurchaseOrderDialog } from "./purchase-order-dialog";
import { exportToCsv } from "@/lib/utils/export-csv";

type PO = {
  id: string;
  poNo: string;
  vendorId: string;
  orderDate: string;
  expectedDate: string | null;
  status: "draft" | "submitted" | "approved" | "partial" | "received" | "closed" | "cancelled";
  subtotal: string;
  taxTotal: string;
  total: string;
  notes: string | null;
  vendorName: string | null;
};

type Vendor = { id: string; name: string; code: string | null };
type Item = { id: string; sku: string; name: string };
type TaxRate = { id: string; name: string; rate: string };

type Props = {
  pos: PO[];
  activeVendors: Vendor[];
  activeItems: Item[];
  activeTaxRates: TaxRate[];
  canCreate: boolean;
  canApprove: boolean;
  fromReqId: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-800",
  approved:  "bg-green-100 text-green-800",
  partial:   "bg-amber-100 text-amber-800",
  received:  "bg-teal-100 text-teal-800",
  closed:    "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
};

function fmt(v: string) {
  return parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PurchaseOrdersTable({
  pos,
  activeVendors,
  activeItems,
  activeTaxRates,
  canCreate,
  canApprove,
  fromReqId,
}: Props) {
  const [dialogKey, setDialogKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Auto-open dialog if redirected from a requisition
  useEffect(() => {
    if (fromReqId && canCreate) {
      setDialogKey((k) => k + 1);
      setOpen(true);
    }
  }, [fromReqId, canCreate]);

  function handleStatusChange(
    id: string,
    newStatus: "submitted" | "approved" | "cancelled"
  ) {
    setPending((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        const res = await updatePoStatusAction(id, newStatus);
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
        <h1 className="text-xl font-semibold">Purchase Orders</h1>
        <div className="flex items-center gap-2">
          {pos.length > 0 && (
            <button
              onClick={() =>
                exportToCsv("purchase-orders", pos as unknown as Record<string, unknown>[], [
                  { key: "poNo", label: "PO No" },
                  { key: "vendorName", label: "Vendor" },
                  { key: "orderDate", label: "Order Date" },
                  { key: "expectedDate", label: "Expected Date" },
                  { key: "status", label: "Status" },
                  { key: "subtotal", label: "Subtotal" },
                  { key: "taxTotal", label: "Tax" },
                  { key: "total", label: "Total" },
                ])
              }
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Export CSV
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => { setDialogKey((k) => k + 1); setOpen(true); }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              New PO
            </button>
          )}
        </div>
      </div>

      {pos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">PO No</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Vendor</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                <th className="px-4 py-2 text-right font-medium">Tax</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => (
                <tr key={po.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{po.poNo}</td>
                  <td className="px-4 py-2">{po.orderDate}</td>
                  <td className="px-4 py-2">{po.vendorName ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[po.status] ?? ""}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{fmt(po.subtotal)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{fmt(po.taxTotal)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs font-semibold">{fmt(po.total)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {po.status === "draft" && canCreate && (
                        <button
                          disabled={pending.has(po.id)}
                          onClick={() => handleStatusChange(po.id, "submitted")}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          {pending.has(po.id) ? "…" : "Submit"}
                        </button>
                      )}
                      {po.status === "submitted" && canApprove && (
                        <>
                          <button
                            disabled={pending.has(po.id)}
                            onClick={() => handleStatusChange(po.id, "approved")}
                            className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                          >
                            {pending.has(po.id) ? "…" : "Approve"}
                          </button>
                          <button
                            disabled={pending.has(po.id)}
                            onClick={() => handleStatusChange(po.id, "cancelled")}
                            className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {(po.status === "approved" || po.status === "partial") && (
                        <a
                          href={`/app/procurement/grns?from_po=${po.id}`}
                          className="rounded px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                        >
                          Create GRN →
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

      <PurchaseOrderDialog
        key={dialogKey}
        open={open}
        onClose={() => setOpen(false)}
        activeVendors={activeVendors}
        activeItems={activeItems}
        activeTaxRates={activeTaxRates}
        fromReqId={fromReqId}
      />
    </div>
  );
}
