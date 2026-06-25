"use client";

import { startTransition, useState } from "react";
import Link from "next/link";

import { ShieldCheck } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { deleteRoleAction } from "@/server/actions/roles";

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
};

type RolesTableProps = {
  roles: RoleRow[];
  canEdit: boolean;
  canDelete: boolean;
};

export function RolesTable({ roles, canEdit, canDelete }: RolesTableProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const showActionsColumn = canEdit || canDelete;

  async function handleDelete(roleId: string) {
    setErrors((prev) => ({ ...prev, [roleId]: "" }));
    setPendingId(roleId);
    startTransition(async () => {
      const result = await deleteRoleAction(roleId);
      setPendingId(null);
      if (!result.success) {
        setErrors((prev) => ({ ...prev, [roleId]: result.error }));
      }
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="hidden sm:table-cell">Description</TableHead>
          <TableHead className="text-center">Permissions</TableHead>
          <TableHead className="text-center">Type</TableHead>
          {showActionsColumn && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.length === 0 && (
          <TableRow>
            <TableCell colSpan={showActionsColumn ? 5 : 4} className="p-0">
              <EmptyState
                icon={ShieldCheck}
                title="No roles found"
                description="Create a custom role to grant specific permissions to your team members."
              />
            </TableCell>
          </TableRow>
        )}
        {roles.map((role) => (
          <>
            <TableRow key={role.id}>
              <TableCell className="font-medium">{role.name}</TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                {role.description ?? "—"}
              </TableCell>
              <TableCell className="text-center text-sm">{role.permissionCount}</TableCell>
              <TableCell className="text-center">
                {role.isSystem ? (
                  <Badge variant="secondary">System</Badge>
                ) : (
                  <Badge variant="outline">Custom</Badge>
                )}
              </TableCell>
              {showActionsColumn && (
                <TableCell className="text-right">
                  {!role.isSystem && (
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && (
                        <Link
                          href={`/admin/roles/${role.id}/edit`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        >
                          Edit
                        </Link>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={pendingId === role.id}
                          onClick={() => handleDelete(role.id)}
                        >
                          {pendingId === role.id ? "Deleting…" : "Delete"}
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              )}
            </TableRow>
            {errors[role.id] && (
              <TableRow key={`${role.id}-error`}>
                <TableCell
                  colSpan={showActionsColumn ? 5 : 4}
                  className="py-1 px-4 text-sm text-destructive bg-destructive/5"
                >
                  {errors[role.id]}
                </TableCell>
              </TableRow>
            )}
          </>
        ))}
      </TableBody>
    </Table>
  );
}
