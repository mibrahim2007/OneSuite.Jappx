"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import { TicketIcon, Plus, Pencil, Trash2 } from "lucide-react";

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
import { SELECT_CLASS } from "@/lib/ui-constants";
import { deleteTicketAction } from "@/server/actions/crm/tickets";
import { TicketDialog } from "./ticket-dialog";

type TicketRow = {
  id: string;
  ticketNo: string;
  subject: string;
  description: string | null;
  companyId: string | null;
  contactId: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "pending" | "resolved" | "closed";
  assignedTo: string | null;
  dueAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  companyName: string | null;
  contactName: string | null;
  assigneeName: string | null;
};

type Company = { id: string; name: string };
type Contact = { id: string; fullName: string; companyId: string | null };
type User = { id: string; fullName: string };

const PRIORITY_VARIANT: Record<string, string> = {
  low: "secondary",
  medium: "outline",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  urgent: "destructive",
};

const STATUS_VARIANT: Record<string, string> = {
  open: "default",
  pending: "secondary",
  resolved: "bg-green-100 text-green-800 border-green-200",
  closed: "outline",
};

function SlaCell({ dueAt }: { dueAt: Date | null }) {
  if (!dueAt) return <span className="text-muted-foreground text-xs">—</span>;
  const now = Date.now();
  const due = dueAt.getTime();
  const diffH = (due - now) / 3_600_000;
  if (diffH < 0) return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
  if (diffH < 24) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Due Soon</Badge>;
  return <span className="text-xs">{dueAt.toLocaleDateString()}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const variant = PRIORITY_VARIANT[priority];
  if (variant === "secondary" || variant === "outline" || variant === "destructive") {
    return <Badge variant={variant as "secondary" | "outline" | "destructive"} className="capitalize text-xs">{priority}</Badge>;
  }
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variant}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status];
  if (variant === "default" || variant === "secondary" || variant === "outline" || variant === "destructive") {
    return <Badge variant={variant as "default" | "secondary" | "outline" | "destructive"} className="capitalize text-xs">{status}</Badge>;
  }
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variant}`}>{status}</span>;
}

export function TicketsTable({
  tickets,
  companies,
  contacts,
  users,
}: {
  tickets: TicketRow[];
  companies: Company[];
  contacts: Contact[];
  users: User[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editing, setEditing] = useState<TicketRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const statusFilter = searchParams.get("status") ?? "all";
  const priorityFilter = searchParams.get("priority") ?? "all";

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key);
    else params.set(key, value);
    router.push(`/app/crm/tickets?${params.toString()}` as Route);
  }

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(t: TicketRow) {
    setEditing(t);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this ticket? Only closed tickets can be deleted.")) return;
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteTicketAction(id);
      setDeletingId(null);
      if (result.success) {
        toast.success("Ticket deleted.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to delete ticket.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className={SELECT_CLASS + " w-36"}
            value={statusFilter}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            className={SELECT_CLASS + " w-36"}
            value={priorityFilter}
            onChange={(e) => setFilter("priority", e.target.value)}
          >
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4 mr-1" />
          New Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title="No tickets found"
          description="Support tickets will appear here. Create one to get started."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4 mr-1" />
              New Ticket
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Ticket #</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA / Due</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/app/crm/tickets/${t.id}` as Route)}
                >
                  <TableCell className="font-mono text-xs">{t.ticketNo}</TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">{t.subject}</TableCell>
                  <TableCell className="text-sm">{t.companyName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">{t.contactName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell><SlaCell dueAt={t.dueAt} /></TableCell>
                  <TableCell className="text-sm">{t.assigneeName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:text-destructive"
                        disabled={isPending && deletingId === t.id}
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TicketDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        companies={companies}
        contacts={contacts}
        users={users}
      />
    </div>
  );
}
