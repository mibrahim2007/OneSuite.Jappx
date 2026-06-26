"use client";

import { useState } from "react";
import { PaymentDialog } from "./payment-dialog";
import type { Payment } from "@/lib/db/schema";

type PaymentRow = {
  id: string;
  paymentNo: string;
  direction: "inbound" | "outbound";
  method: string;
  amount: string;
  paymentDate: string;
  reference: string | null;
  partyName: string | null;
  bankAccountName: string | null;
  createdAt: Date;
};

type PostedBill = { id: string; billNo: string; total: string; vendorId: string; vendorName: string | null };
type PostedInvoice = { id: string; invoiceNo: string; total: string; customerId: string; customerName: string | null };
type BankAccount = { id: string; name: string; code: string };

type Props = {
  rows: PaymentRow[];
  postedBills: PostedBill[];
  postedInvoices: PostedInvoice[];
  bankAccounts: BankAccount[];
  canCreate: boolean;
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bank: "Bank Transfer", cheque: "Cheque",
  card: "Card", online: "Online", adjustment: "Adjustment",
};

export function PaymentsView({ rows, postedBills, postedInvoices, bankAccounts, canCreate }: Props) {
  const [tab, setTab] = useState<"outbound" | "inbound">("outbound");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDirection, setDialogDirection] = useState<"outbound" | "inbound">("outbound");
  const [dialogKey, setDialogKey] = useState(0);

  const filtered = rows.filter((r) => r.direction === tab);

  function openDialog(direction: "outbound" | "inbound") {
    setDialogDirection(direction);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Payments & Receipts</h1>
        {canCreate && (
          <div className="flex gap-2">
            <button
              onClick={() => openDialog("outbound")}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              New Payment
            </button>
            <button
              onClick={() => openDialog("inbound")}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              New Receipt
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b">
        {(["outbound", "inbound"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "outbound" ? "Payments (AP)" : "Receipts (AR)"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No {tab === "outbound" ? "payments" : "receipts"} recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">{tab === "outbound" ? "Vendor" : "Customer"}</th>
                <th className="px-4 py-3 text-left font-medium">Bank Account</th>
                <th className="px-4 py-3 text-left font-medium">Method</th>
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{row.paymentNo}</td>
                  <td className="px-4 py-3">{row.paymentDate}</td>
                  <td className="px-4 py-3">{row.partyName ?? "—"}</td>
                  <td className="px-4 py-3">{row.bankAccountName ?? "—"}</td>
                  <td className="px-4 py-3">{METHOD_LABELS[row.method] ?? row.method}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {parseFloat(row.amount).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-sm font-medium">Total</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  {filtered.reduce((s, r) => s + parseFloat(r.amount), 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canCreate && (
        <PaymentDialog
          key={dialogKey}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          direction={dialogDirection}
          postedBills={postedBills}
          postedInvoices={postedInvoices}
          bankAccounts={bankAccounts}
        />
      )}
    </div>
  );
}
