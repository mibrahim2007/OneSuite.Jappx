"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Bill, BillLine } from "@/lib/db/schema";

type BillDetailProps = {
  bill: Bill;
  lines: BillLine[];
};

function statusVariant(
  status: string
): "secondary" | "outline" | "destructive" | "default" {
  if (status === "posted") return "outline";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

export function BillDetail({ bill, lines }: BillDetailProps) {
  const router = useRouter();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{bill.billNo}</h1>
            <Badge variant={statusVariant(bill.status)}>
              {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vendor bill — read only
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/app/accounts/bills")}
        >
          Back to Bills
        </Button>
      </div>

      {/* Header grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3 rounded-md border p-4">
        <div>
          <p className="text-muted-foreground text-xs">Bill Date</p>
          <p className="font-medium tabular-nums">{bill.billDate}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Due Date</p>
          <p className="font-medium tabular-nums">{bill.dueDate}</p>
        </div>
        {bill.reference && (
          <div>
            <p className="text-muted-foreground text-xs">Reference</p>
            <p className="font-medium">{bill.reference}</p>
          </div>
        )}
        {bill.notes && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-muted-foreground text-xs">Notes</p>
            <p className="font-medium">{bill.notes}</p>
          </div>
        )}
        {bill.journalId && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-muted-foreground text-xs">Journal Entry</p>
            <p className="font-mono text-xs">{bill.journalId}</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Account
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Description
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Amount
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Tax
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Line Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line) => {
              const amt = parseFloat(line.amount);
              const tax = parseFloat(line.taxAmount);
              return (
                <tr key={line.id}>
                  <td className="px-4 py-2 font-mono text-xs">
                    {line.accountId}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {line.description ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {amt.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {tax > 0 ? tax.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {(amt + tax).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/20">
            <tr>
              <td
                colSpan={2}
                className="px-4 py-2 text-right text-sm text-muted-foreground"
              >
                Subtotal
              </td>
              <td
                colSpan={3}
                className="px-4 py-2 text-right font-mono font-medium"
              >
                {parseFloat(bill.subtotal).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={2}
                className="px-4 py-2 text-right text-sm text-muted-foreground"
              >
                Tax
              </td>
              <td
                colSpan={3}
                className="px-4 py-2 text-right font-mono font-medium"
              >
                {parseFloat(bill.taxAmount).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={2}
                className="px-4 py-2 text-right text-sm font-semibold"
              >
                Total
              </td>
              <td
                colSpan={3}
                className="px-4 py-2 text-right font-mono font-semibold"
              >
                {parseFloat(bill.total).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
