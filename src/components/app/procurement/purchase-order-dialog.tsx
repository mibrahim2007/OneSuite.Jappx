"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { createPurchaseOrderAction } from "@/server/actions/procurement/purchase-orders";
import { SELECT_CLASS } from "@/lib/ui-constants";

type Vendor = { id: string; name: string; code: string | null };
type Item = { id: string; sku: string; name: string };
type TaxRate = { id: string; name: string; rate: string };
type PoLine = { itemId: string; quantity: string; unitPrice: string; taxRateId: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  activeVendors: Vendor[];
  activeItems: Item[];
  activeTaxRates: TaxRate[];
  fromReqId: string | null;
};

const today = new Date().toISOString().split("T")[0];

export function PurchaseOrderDialog({
  open,
  onClose,
  activeVendors,
  activeItems,
  activeTaxRates,
  fromReqId,
}: Props) {
  const [state, formAction, isPending] = useActionState(createPurchaseOrderAction, null);
  const [lines, setLines] = useState<PoLine[]>([
    { itemId: "", quantity: "", unitPrice: "0", taxRateId: null },
  ]);

  useEffect(() => {
    if (state?.success) {
      toast.success("Purchase order created.");
      onClose();
    } else if (state && !state.success) {
      toast.error(state.error);
    }
  }, [state, onClose]);

  if (!open) return null;

  function addLine() {
    setLines((prev) => [...prev, { itemId: "", quantity: "", unitPrice: "0", taxRateId: null }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, field: keyof PoLine, value: string | null) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  const subtotal = lines.reduce((sum, l) => {
    const q = parseFloat(l.quantity) || 0;
    const p = parseFloat(l.unitPrice) || 0;
    return sum + q * p;
  }, 0);

  const taxTotal = lines.reduce((sum, l) => {
    const q = parseFloat(l.quantity) || 0;
    const p = parseFloat(l.unitPrice) || 0;
    const lineTotal = q * p;
    const taxRate = l.taxRateId
      ? parseFloat(activeTaxRates.find((t) => t.id === l.taxRateId)?.rate ?? "0")
      : 0;
    return sum + lineTotal * (taxRate / 100);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-base font-semibold">New Purchase Order</h2>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="lines" value={JSON.stringify(lines)} />
          {fromReqId && <input type="hidden" name="fromReqId" value={fromReqId} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">PO No *</label>
              <input
                name="poNo"
                required
                className="w-full rounded-md border px-3 py-1.5 text-sm"
                placeholder="PO-001"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Vendor *</label>
              <select name="vendorId" required className={`w-full ${SELECT_CLASS}`}>
                <option value="">Select vendor…</option>
                {activeVendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Order Date *</label>
              <input
                name="orderDate"
                type="date"
                required
                defaultValue={today}
                className="w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Expected Date</label>
              <input
                name="expectedDate"
                type="date"
                className="w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              placeholder="Optional…"
            />
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
                <div key={i} className="grid grid-cols-[1fr_80px_90px_110px_20px] gap-2 items-center">
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
                    placeholder="Price"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                    required
                    className="rounded-md border px-2 py-1.5 text-sm"
                  />
                  <select
                    className={SELECT_CLASS}
                    value={line.taxRateId ?? ""}
                    onChange={(e) => updateLine(i, "taxRateId", e.target.value || null)}
                  >
                    <option value="">No tax</option>
                    {activeTaxRates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                    ))}
                  </select>
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

          <div className="rounded-md bg-muted/40 p-3 text-right text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-mono">{taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="font-mono">{(subtotal + taxTotal).toFixed(2)}</span>
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
