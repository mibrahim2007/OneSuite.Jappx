"use client";

import { startTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revokeInvitationAction } from "@/server/actions/invitations";

type PendingInvitation = {
  id: string;
  email: string;
  roleName: string | null;
  expiresAt: Date;
  createdAt: Date;
};

export function PendingInvitations({
  invitations,
}: {
  invitations: PendingInvitation[];
}) {
  if (invitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No pending invitations.
      </p>
    );
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeInvitationAction(id);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Invited</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((inv) => (
          <TableRow key={inv.id}>
            <TableCell className="font-medium">{inv.email}</TableCell>
            <TableCell>{inv.roleName ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {inv.createdAt.toLocaleDateString()}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {inv.expiresAt.toLocaleDateString()}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">Pending</Badge>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleRevoke(inv.id)}
              >
                Revoke
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
