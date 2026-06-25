"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountDialog } from "@/components/app/accounts/account-dialog";
import { toggleAccountActiveAction } from "@/server/actions/accounts";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validations/accounts";
import type { Account, AccountGroup } from "@/lib/db/schema";

type CoaTableProps = {
  accounts: Account[];
  groups: AccountGroup[];
  canCreate: boolean;
  canEdit: boolean;
};

export function CoaTable({ accounts, groups, canCreate, canEdit }: CoaTableProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [togglePending, setTogglePending] = useState<Set<string>>(new Set());
  const [, startToggleTransition] = useTransition();

  const groupById = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g.name])),
    [groups]
  );

  function openNew() {
    setEditingAccount(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(account: Account) {
    setEditingAccount(account);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function handleToggle(id: string, currentlyActive: boolean) {
    setTogglePending((prev) => new Set(prev).add(id));
    startToggleTransition(async () => {
      try {
        const result = await toggleAccountActiveAction(id, !currentlyActive);
        if (!result.success) {
          toast.error(result.error ?? "Failed to update status.");
        } else {
          router.refresh();
          toast.success(currentlyActive ? "Account deactivated." : "Account activated.");
        }
      } catch {
        toast.error("Failed to update account status.");
      } finally {
        setTogglePending((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define accounts used to categorize all financial transactions.
        </p>
        {canCreate && (
          <Button size="sm" onClick={openNew}>
            New Account
          </Button>
        )}
      </div>

      <AccountDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingAccount={editingAccount}
        groups={groups}
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No accounts yet"
          description="No accounts yet. Add your first account to get started."
          action={
            canCreate ? (
              <Button size="sm" onClick={openNew}>
                Add Account
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow
                key={account.id}
                className={!account.isActive ? "opacity-60" : undefined}
              >
                <TableCell className="font-mono text-sm">{account.code}</TableCell>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell>
                  {ACCOUNT_TYPE_LABELS[account.type as keyof typeof ACCOUNT_TYPE_LABELS] ??
                    account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {account.groupId ? (groupById[account.groupId] ?? "—") : "—"}
                </TableCell>
                <TableCell>
                  {account.isActive ? (
                    <Badge variant="outline">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    {!account.isSystem ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(account)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={togglePending.has(account.id)}
                          onClick={() => handleToggle(account.id, account.isActive)}
                        >
                          {togglePending.has(account.id)
                            ? "…"
                            : account.isActive
                              ? "Deactivate"
                              : "Activate"}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">System</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
