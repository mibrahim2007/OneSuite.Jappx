"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";

import { postGrnAction, cancelGrnAction } from "@/server/actions/procurement/grns";
import { GrnDialog } from "./grn-dialog";

type Grn = {
  id: string;
  grnNo: string;
  poId: string | null;
  warehouseId: string;
  receiptDate: string;
  status: "draft" | "posted" | "cancelled";
  createdAt: Date;
  poNo: string | null;
  warehouseName: string | null;
};

type Warehouse = { id: string; name: string; code: string };
type Item = { id: string; sku: string; name: string };
type PoLine = {
  id: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  itemSku: string;
  itemName: string;
};

type Props = {
  grns: Grn[];
  activeWarehouses: Warehouse[];
  activeItems: Item[];
  canCreate: boolean;
  fromPoId: string | null;
  fromPoLines: PoLine[];
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-700",
  posted:    "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function GrnsTable({ grns, activeWarehouses, activeItems, canCreate, fromPoId, fromPoLines }: Props) {
  const [dialogKey, setDialogKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (fromPoId && canCreate) {
      setDialogKey((k) => k + 1);
      setOpen(true);
    }
  }, [fromPoId, canCreate]);

  function handlePost(id: string) {
    setPending((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        const res = await postGrnAction(id);
        if (res.success) toast.success("GRN posted. Stock updated.");
        else toast.error(res.error ?? "Failed.");
      } catch {
        toast.error("Unexpected error.");
      } finally {
        setPending((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }
    });
  }

  function handleCancel(id: string) {
    setPending((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        const res = await cancelGrnAction(id);
        if (!res.success) toast.error(res.error ?? "Failed.");
      } catch {
        toast.error("Unexpected error.");
      } finally {
        setPending((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Goods Receipt Notes</h1>
        {canCreate && (
          <button
            onClick={() => { setDialogKey((k) => k + 1); setOpen(true); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New GRN
          </button>
        )}
      </div>

      {grns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No goods receipts yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">GRN No</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">PO No</th>
                <th className="px-4 py-2 text-left font-medium">Warehouse</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grns.map((grn) => (
                <tr key={grn.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{grn.grnNo}</td>
                  <td className="px-4 py-2">{grn.receiptDate}</td>
                  <td className="px-4 py-2 font-mono text-xs">{grn.poNo ?? "—"}</td>
                  <td className="px-4 py-2">{grn.warehouseName ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[grn.status] ?? ""}`}>
                      {grn.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {grn.status === "draft" && canCreate && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={pending.has(grn.id)}
                          onClick={() => handlePost(grn.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                          {pending.has(grn.id) ? "…" : "Post"}
                        </button>
                        <button
                          disabled={pending.has(grn.id)}
                          onClick={() => handleCancel(grn.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GrnDialog
        key={dialogKey}
        open={open}
        onClose={() => setOpen(false)}
        activeWarehouses={activeWarehouses}
        activeItems={activeItems}
        fromPoId={fromPoId}
        fromPoLines={fromPoLines}
      />
    </div>
  );
}
