"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createPaymentAction } from "@/server/actions/payments";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { PAYMENT_METHODS } from "@/lib/validations/payments";

type PostedBill = { id: string; billNo: string; total: string; vendorId: string; vendorName: string | null };
type PostedInvoice = { id: string; invoiceNo: string; total: string; customerId: string; customerName: string | null };
type BankAccount = { id: string; name: string; code: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  direction: "outbound" | "inbound";
  postedBills: PostedBill[];
  postedInvoices: PostedInvoice[];
  bankAccounts: BankAccount[];
};

const today = new Date().toISOString().slice(0, 10);

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bank: "Bank Transfer", cheque: "Cheque",
  card: "Card", online: "Online", adjustment: "Adjustment",
};

export function PaymentDialog({ open, onOpenChange, direction, postedBills, postedInvoices, bankAccounts }: Props) {
  const [state, formAction, isPending] = useActionState(createPaymentAction, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(direction === "outbound" ? "Payment recorded." : "Receipt recorded.");
      onOpenChange(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  if (!open) return null;

  const isOutbound = direction === "outbound";
  const docs = isOutbound ? postedBills : postedInvoices;

  function handleDocChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const docId = e.currentTarget.value;
    const doc = docs.find((d) => d.id === docId);
    if (!doc) return;
    const amtInput = document.getElementById("payment-amount") as HTMLInputElement | null;
    if (amtInput) amtInput.value = parseFloat(doc.total).toFixed(2);
    const partyInput = document.getElementById("payment-party") as HTMLInputElement | null;
    if (partyInput) {
      const party = isOutbound
        ? (doc as PostedBill).vendorId
        : (doc as PostedInvoice).customerId;
      partyInput.value = party;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">
          {isOutbound ? "Record Payment" : "Record Receipt"}
        </h2>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="partyId" id="payment-party" />

          {/* Document selector */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              {isOutbound ? "Bill to Pay" : "Invoice to Receive Against"}
            </label>
            <select
              name={isOutbound ? "billId" : "invoiceId"}
              className={SELECT_CLASS}
              required
              defaultValue=""
              onChange={handleDocChange}
            >
              <option value="" disabled>Select…</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {isOutbound
                    ? `${(d as PostedBill).billNo} — ${(d as PostedBill).vendorName ?? "?"} — ${parseFloat(d.total).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`
                    : `${(d as PostedInvoice).invoiceNo} — ${(d as PostedInvoice).customerName ?? "?"} — ${parseFloat(d.total).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`
                  }
                </option>
              ))}
            </select>
          </div>

          {/* Bank account */}
          <div>
            <label className="mb-1 block text-sm font-medium">Bank Account</label>
            <select name="bankAccountId" className={SELECT_CLASS} required defaultValue="">
              <option value="" disabled>Select bank account…</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>

          {/* Method */}
          <div>
            <label className="mb-1 block text-sm font-medium">Method</label>
            <select name="method" className={SELECT_CLASS} defaultValue="bank">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium">Amount</label>
            <input
              id="payment-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium">Date</label>
            <input
              name="paymentDate"
              type="date"
              required
              defaultValue={today}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          {/* Reference */}
          <div>
            <label className="mb-1 block text-sm font-medium">Reference <span className="text-muted-foreground">(optional)</span></label>
            <input
              name="reference"
              type="text"
              maxLength={100}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
