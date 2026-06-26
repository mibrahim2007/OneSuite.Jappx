"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
  total: string | null;
  invoiceId: string | null;
  companyName: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  sent: "default",
  accepted: "default",
  rejected: "destructive",
  expired: "secondary",
} as const;

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
};

type Props = {
  quotations: QuotRow[];
  canCreate: boolean;
  canApprove: boolean;
};

export function QuotationsList({ quotations, canCreate, canApprove }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleStatus(id: string, status: QuotRow["status"]) {
    setPendingId(id + status);
    startTransition(async () => {
      const res = await updateQuotationStatusAction(id, status);
      if (res.success) router.refresh();
      else toast.error(res.error);
      setPendingId(null);
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canCreate && (
          <Link href={"/app/crm/quotations/new" as Route}>
            <Button size="sm">
              <Plus className="size-4 mr-1" /> New Quotation
            </Button>
          </Link>
        )}
      </div>

      {quotations.length === 0 ? (
        <EmptyState icon={FileText} title="No quotations yet" description="Create your first quotation." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote #</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              {canApprove && <TableHead className="w-40" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">
                  <Link href={`/app/crm/quotations/${q.id}` as Route} className="text-primary hover:underline">
                    {q.quoteNo}
                  </Link>
                </TableCell>
                <TableCell>{q.companyName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{q.quoteDate}</TableCell>
                <TableCell>{q.validUntil ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right font-medium">
                  {q.total ? parseFloat(q.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLORS[q.status] as "default" | "secondary" | "destructive" | "outline"}>
                    {q.status}
                  </Badge>
                </TableCell>
                {canApprove && (
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {STATUS_TRANSITIONS[q.status]?.map((next) => (
                        <Button
                          key={next}
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          disabled={pendingId === q.id + next}
                          onClick={() => handleStatus(q.id, next as QuotRow["status"])}
                        >
                          {next}
                        </Button>
                      ))}
                      {q.invoiceId && (
                        <Link href={`/app/accounts/invoices/${q.invoiceId}` as Route}>
                          <Badge variant="outline" className="cursor-pointer text-xs">Invoice</Badge>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
