"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, CheckCircle, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteBillAction, postBillAction } from "@/server/actions/bills";
import type { Bill } from "@/lib/db/schema";

type BillRow = Bill & { vendorName: string };

type BillsListProps = {
  bills: BillRow[];
  canCreate: boolean;
  canManage: boolean;
  canPost: boolean;
  canDelete: boolean;
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

export function BillsList({ bills, canCreate, canManage, canPost, canDelete }: BillsListProps) {
  const router = useRouter();
  const [pendingPostIds, setPendingPostIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(
    new Set()
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, startPostTransition] = useTransition();
  const [, startDeleteTransition] = useTransition();

  function handlePost(id: string) {
    setPendingPostIds((s) => new Set(s).add(id));
    startPostTransition(async () => {
      try {
        const result = await postBillAction(id);
        if (result.success) {
          toast.success("Bill posted to general ledger.");
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to post bill.");
        }
      } catch {
        toast.error("Failed to post bill.");
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
        const result = await deleteBillAction(id);
        if (result.success) {
          toast.success("Bill deleted.");
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to delete bill.");
        }
      } catch {
        toast.error("Failed to delete bill.");
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
          <h1 className="text-2xl font-semibold">Vendor Bills</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage accounts payable bills from vendors.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/app/accounts/bills/new")}>
            New Bill
          </Button>
        )}
      </div>

      {bills.length === 0 ? (
        <div className="rounded-md border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">No bills yet.</p>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push("/app/accounts/bills/new")}
            >
              Create your first bill
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Bill No
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Vendor
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Bill Date
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
              {bills.map((bill) => {
                const isPostPending = pendingPostIds.has(bill.id);
                const isDeletePending = pendingDeleteIds.has(bill.id);
                const isConfirmingDelete = confirmDeleteId === bill.id;
                const isDraft = bill.status === "draft";

                return (
                  <tr key={bill.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {bill.billNo}
                    </td>
                    <td className="px-4 py-2.5">{bill.vendorName}</td>
                    <td className="px-4 py-2.5 tabular-nums">{bill.billDate}</td>
                    <td className="px-4 py-2.5 tabular-nums">{bill.dueDate}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {parseFloat(bill.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={statusVariant(bill.status)}>
                        {statusLabel(bill.status)}
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
                              onClick={() => handleDelete(bill.id)}
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
                              title={isDraft && canManage ? "Edit" : "View"}
                              onClick={() =>
                                router.push(`/app/accounts/bills/${bill.id}`)
                              }
                            >
                              {isDraft && canManage ? (
                                <Pencil className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>

                            {/* Post */}
                            {isDraft && canPost && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Post to GL"
                                disabled={isPostPending}
                                onClick={() => handlePost(bill.id)}
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
                                onClick={() => setConfirmDeleteId(bill.id)}
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
