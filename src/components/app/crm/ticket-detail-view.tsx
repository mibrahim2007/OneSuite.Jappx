"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowLeft } from "lucide-react";
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

const PRIORITY_COLORS: Record<string, string> = {
  low: "secondary",
  medium: "outline",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  urgent: "destructive",
};

const STATUS_COLORS: Record<string, string> = {
  open: "default",
  pending: "secondary",
  resolved: "bg-green-100 text-green-800 border-green-200",
  closed: "outline",
};

function SlaStatus({ dueAt }: { dueAt: Date | null }) {
  if (!dueAt) return <span className="text-muted-foreground">No SLA set</span>;
  const now = Date.now();
  const due = dueAt.getTime();
  const diffH = (due - now) / 3_600_000;
  if (diffH < 0) return <Badge variant="destructive">Overdue</Badge>;
  if (diffH < 24) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Due Soon</Badge>;
  return <span>{dueAt.toLocaleDateString()}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const v = PRIORITY_COLORS[priority];
  if (v === "secondary" || v === "outline" || v === "destructive") {
    return <Badge variant={v as "secondary" | "outline" | "destructive"} className="capitalize">{priority}</Badge>;
  }
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${v}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const v = STATUS_COLORS[status];
  if (v === "default" || v === "secondary" || v === "outline" || v === "destructive") {
    return <Badge variant={v as "default" | "secondary" | "outline" | "destructive"} className="capitalize">{status}</Badge>;
  }
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${v}`}>{status}</span>;
}

export function TicketDetailView({
  ticket,
  companies,
  contacts,
  users,
}: {
  ticket: TicketRow;
  companies: Company[];
  contacts: Contact[];
  users: User[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  function openEdit() {
    setDialogKey((k) => k + 1);
    setEditOpen(true);
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href={"/app/crm/tickets" as Route}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1">{ticket.ticketNo}</p>
          <h1 className="text-2xl font-semibold">{ticket.subject}</h1>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <SlaStatus dueAt={ticket.dueAt} />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openEdit}>
          <Pencil className="size-4 mr-1" />
          Edit
        </Button>
      </div>

      {ticket.description && (
        <div className="rounded-md border bg-muted/30 p-4 mb-6">
          <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Company</dt>
          <dd className="mt-1">{ticket.companyName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Contact</dt>
          <dd className="mt-1">{ticket.contactName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Assigned To</dt>
          <dd className="mt-1">{ticket.assigneeName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Created</dt>
          <dd className="mt-1">{ticket.createdAt.toLocaleString()}</dd>
        </div>
        {ticket.resolvedAt && (
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Resolved</dt>
            <dd className="mt-1">{ticket.resolvedAt.toLocaleString()}</dd>
          </div>
        )}
      </dl>

      <TicketDialog
        key={dialogKey}
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={ticket}
        companies={companies}
        contacts={contacts}
        users={users}
      />
    </div>
  );
}
