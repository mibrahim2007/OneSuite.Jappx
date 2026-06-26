"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateQuotationStatusAction } from "@/server/actions/crm/quotations";

type QuotRow = {
  id: string;
  quoteNo: string;
  quoteDate: string;
  validUntil: string | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  subtotal: string | null;
  taxTotal: string | null;
  total: string | null;
  invoiceId: string | null;
  opportunityId: string | null;
  companyId: string | null;
  companyName: string | null;
  opportunityTitle: string | null;
};

type LineRow = {
  id: string;
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
};

const STATUS_TRANSITIONS: Record<string, Array<"draft" | "sent" | "accepted" | "rejected" | "expired">> = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
};

type Props = {
  quotation: QuotRow;
  lines: LineRow[];
  canApprove: boolean;
  canInvoice: boolean;
};

export function QuotationDetail({ quotation, lines, canApprove, canInvoice }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  function handleStatus(status: "draft" | "sent" | "accepted" | "rejected" | "expired") {
    setPendingStatus(status);
    startTransition(async () => {
      const res = await updateQuotationStatusAction(quotation.id, status);
      if (res.success) router.refresh();
      else toast.error(res.error);
      setPendingStatus(null);
    });
  }

  const transitions = STATUS_TRANSITIONS[quotation.status] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={"/app/crm/quotations" as Route}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{quotation.quoteNo}</h1>
          <p className="text-sm text-muted-foreground">Quotation</p>
        </div>
        <Badge className="ml-auto">{quotation.status}</Badge>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Company</p>
          <p className="font-medium">{quotation.companyName ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Opportunity</p>
          <p className="font-medium">{quotation.opportunityTitle ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Quote Date</p>
          <p className="font-medium">{quotation.quoteDate}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Valid Until</p>
          <p className="font-medium">{quotation.validUntil ?? "—"}</p>
        </div>
      </div>

      {/* Lines */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right w-24">Qty</TableHead>
            <TableHead className="text-right w-32">Unit Price</TableHead>
            <TableHead className="text-right w-32">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.description}</TableCell>
              <TableCell className="text-right">{l.quantity ?? "1"}</TableCell>
              <TableCell className="text-right">
                {l.unitPrice ? parseFloat(l.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {l.lineTotal ? parseFloat(l.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="text-sm space-y-1 text-right min-w-48">
          <div className="flex justify-between gap-8">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{quotation.subtotal ? parseFloat(quotation.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-muted-foreground">Tax</span>
            <span>{quotation.taxTotal ? parseFloat(quotation.taxTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</span>
          </div>
          <div className="flex justify-between gap-8 font-semibold text-base border-t pt-1">
            <span>Total</span>
            <span>{quotation.total ? parseFloat(quotation.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {canApprove && transitions.length > 0 && (
        <div className="flex gap-2 pt-2">
          {transitions.map((next) => (
            <Button
              key={next}
              variant="outline"
              disabled={pendingStatus === next}
              onClick={() => handleStatus(next)}
            >
              {pendingStatus === next ? "Updating…" : `Mark as ${next}`}
            </Button>
          ))}
        </div>
      )}

      {quotation.invoiceId && (
        <div className="pt-2">
          <Link href={`/app/accounts/invoices/${quotation.invoiceId}` as Route}>
            <Button variant="outline">View Invoice</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
