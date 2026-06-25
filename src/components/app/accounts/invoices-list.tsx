"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, CheckCircle, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteInvoiceAction, postInvoiceAction } from "@/server/actions/invoices";
import type { Invoice } from "@/lib/db/schema";

type InvoiceRow = Invoice & { customerName: string };

type InvoicesListProps = {
  invoices: InvoiceRow[];
  canCreate: boolean;
  canDelete: boolean;
  canApprove: boolean;
};

function statusVariant(
  status: string
): "secondary" | "outline" | "destructive" | "default" {
  if (status === "posted") return "outline";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function InvoicesList({ invoices, canCreate, canDelete, canApprove }: InvoicesListProps) {
  const router = useRouter();
  const [pendingPostIds, setPendingPostIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, startPostTransition] = useTransition();
  const [, startDeleteTransition] = useTransition();

  function handlePost(id: string) {
    setPendingPostIds((s) => new Set(s).add(id));
    startPostTransition(async () => {
      try {
        const result = await postInvoiceAction(id);
        if (result.success) {
          toast.success("Invoice posted to general ledger.");
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to post invoice.");
        }
      } catch {
        toast.error("Failed to post invoice.");
      } finally {
        setPendingPostIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function handleDelete(id: string) {
    setPendingDeleteIds((s) => new Set(s).add(id));
    setConfirmDeleteId(null);
    startDeleteTransition(async () => {
      try {
        const result = await deleteInvoiceAction(id);
        if (result.success) {
          toast.success("Invoice deleted.");
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to delete invoice.");
        }
      } catch {
        toast.error("Failed to delete invoice.");
      } finally {
        setPendingDeleteIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customer Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage accounts receivable invoices.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/app/accounts/invoices/new")}>
            New Invoice
          </Button>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-md border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">No invoices yet.</p>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push("/app/accounts/invoices/new")}
            >
              Create your first invoice
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Invoice No
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Customer
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Invoice Date
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Due Date
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  Total
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((invoice) => {
                const isPostPending = pendingPostIds.has(invoice.id);
                const isDeletePending = pendingDeleteIds.has(invoice.id);
                const isConfirmingDelete = confirmDeleteId === invoice.id;
                const isDraft = invoice.status === "draft";

                return (
                  <tr key={invoice.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {invoice.invoiceNo}
                    </td>
                    <td className="px-4 py-2.5">{invoice.customerName}</td>
                    <td className="px-4 py-2.5 tabular-nums">{invoice.invoiceDate}</td>
                    <td className="px-4 py-2.5 tabular-nums">{invoice.dueDate}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {parseFloat(invoice.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={statusVariant(invoice.status)}>
                        {statusLabel(invoice.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirmingDelete ? (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isDeletePending}
                              onClick={() => handleDelete(invoice.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            {/* View / Edit */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title={isDraft && canCreate ? "Edit" : "View"}
                              onClick={() =>
                                router.push(`/app/accounts/invoices/${invoice.id}`)
                              }
                            >
                              {isDraft && canCreate ? (
                                <Pencil className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>

                            {/* Post / Approve */}
                            {isDraft && canApprove && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Post to GL"
                                disabled={isPostPending}
                                onClick={() => handlePost(invoice.id)}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Delete */}
                            {isDraft && canDelete && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title="Delete"
                                disabled={isDeletePending}
                                onClick={() => setConfirmDeleteId(invoice.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
