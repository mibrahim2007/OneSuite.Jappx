"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useState } from "react";

import { createRequisitionAction } from "@/server/actions/procurement/requisitions";
import { SELECT_CLASS } from "@/lib/ui-constants";

type Item = { id: string; sku: string; name: string };
type Line = { itemId: string; quantity: string };

type Props = {
  open: boolean;
  onClose: () => void;
  activeItems: Item[];
};

const today = new Date().toISOString().split("T")[0];

export function RequisitionDialog({ open, onClose, activeItems }: Props) {
  const [state, formAction, isPending] = useActionState(createRequisitionAction, null);
  const [lines, setLines] = useState<Line[]>([{ itemId: "", quantity: "" }]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Requisition created.");
      onClose();
    } else if (state && !state.success) {
      toast.error(state.error);
    }
  }, [state, onClose]);

  if (!open) return null;

  function addLine() {
    setLines((prev) => [...prev, { itemId: "", quantity: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-base font-semibold">New Requisition</h2>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="lines" value={JSON.stringify(lines)} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Req No *</label>
              <input
                name="reqNo"
                required
                className="w-full rounded-md border px-3 py-1.5 text-sm"
                placeholder="REQ-001"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Date *</label>
              <input
                name="reqDate"
                type="date"
                required
                defaultValue={today}
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
              placeholder="Optional notes…"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Lines *</span>
              <button
                type="button"
                onClick={addLine}
                className="text-xs text-primary hover:underline"
              >
                + Add Line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    className={`flex-1 ${SELECT_CLASS}`}
                    value={line.itemId}
                    onChange={(e) => updateLine(i, "itemId", e.target.value)}
                    required
                  >
                    <option value="">Select item…</option>
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name}
                      </option>
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
                    className="w-24 rounded-md border px-2 py-1.5 text-sm"
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
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm"
            >
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
