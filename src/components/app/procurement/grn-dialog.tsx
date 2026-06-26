"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { createGrnAction } from "@/server/actions/procurement/grns";
import { SELECT_CLASS } from "@/lib/ui-constants";

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
type GrnLine = {
  itemId: string;
  poLineId: string | null;
  quantity: string;
  unitCost: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  activeWarehouses: Warehouse[];
  activeItems: Item[];
  fromPoId: string | null;
  fromPoLines: PoLine[];
};

const today = new Date().toISOString().split("T")[0];

export function GrnDialog({
  open,
  onClose,
  activeWarehouses,
  activeItems,
  fromPoId,
  fromPoLines,
}: Props) {
  const [state, formAction, isPending] = useActionState(createGrnAction, null);

  const initLines = (): GrnLine[] =>
    fromPoLines.length > 0
      ? fromPoLines.map((l) => ({
          itemId: l.itemId,
          poLineId: l.id,
          quantity: l.quantity,
          unitCost: l.unitPrice,
        }))
      : [{ itemId: "", poLineId: null, quantity: "", unitCost: "0" }];

  const [lines, setLines] = useState<GrnLine[]>(initLines);

  useEffect(() => {
    if (state?.success) {
      toast.success("GRN created.");
      onClose();
    } else if (state && !state.success) {
      toast.error(state.error);
    }
  }, [state, onClose]);

  if (!open) return null;

  function addLine() {
    setLines((prev) => [...prev, { itemId: "", poLineId: null, quantity: "", unitCost: "0" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, field: keyof GrnLine, value: string | null) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-base font-semibold">New Goods Receipt Note</h2>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="lines" value={JSON.stringify(lines)} />
          {fromPoId && <input type="hidden" name="poId" value={fromPoId} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">GRN No *</label>
              <input
                name="grnNo"
                required
                className="w-full rounded-md border px-3 py-1.5 text-sm"
                placeholder="GRN-001"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Warehouse *</label>
              <select name="warehouseId" required className={`w-full ${SELECT_CLASS}`}>
                <option value="">Select warehouse…</option>
                {activeWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Receipt Date *</label>
              <input
                name="receiptDate"
                type="date"
                required
                defaultValue={today}
                className="w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Lines *</span>
              <button type="button" onClick={addLine} className="text-xs text-primary hover:underline">
                + Add Line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_90px_20px] gap-2 items-center">
                  <select
                    className={SELECT_CLASS}
                    value={line.itemId}
                    onChange={(e) => updateLine(i, "itemId", e.target.value)}
                    required
                  >
                    <option value="">Item…</option>
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.sku} — {item.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    required
                    className="rounded-md border px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="Unit Cost"
                    value={line.unitCost}
                    onChange={(e) => updateLine(i, "unitCost", e.target.value)}
                    required
                    className="rounded-md border px-2 py-1.5 text-sm"
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
