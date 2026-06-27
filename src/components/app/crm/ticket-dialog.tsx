"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { createTicketAction, updateTicketAction } from "@/server/actions/crm/tickets";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/validations/tickets";

type Company = { id: string; name: string };
type Contact = { id: string; fullName: string; companyId: string | null };
type User = { id: string; fullName: string };

type TicketRow = {
  id: string;
  subject: string;
  description: string | null;
  companyId: string | null;
  contactId: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "pending" | "resolved" | "closed";
  assignedTo: string | null;
  dueAt: Date | null;
};

export function TicketDialog({
  open,
  onOpenChange,
  editing,
  companies,
  contacts,
  users,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TicketRow | null;
  companies: Company[];
  contacts: Contact[];
  users: User[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [companyId, setCompanyId] = useState(editing?.companyId ?? "");

  const filteredContacts = companyId
    ? contacts.filter((c) => c.companyId === companyId)
    : contacts;

  function toDateInputValue(d: Date | null): string {
    if (!d) return "";
    return d.toISOString().split("T")[0]!;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      subject: (fd.get("subject") as string).trim(),
      description: (fd.get("description") as string) || null,
      companyId: (fd.get("companyId") as string) || null,
      contactId: (fd.get("contactId") as string) || null,
      priority: fd.get("priority") as "low" | "medium" | "high" | "urgent",
      status: fd.get("status") as "open" | "pending" | "resolved" | "closed",
      assignedTo: (fd.get("assignedTo") as string) || null,
      dueAt: (fd.get("dueAt") as string) || null,
    };

    startTransition(async () => {
      const result = editing
        ? await updateTicketAction(editing.id, data)
        : await createTicketAction(data);

      if (result.success) {
        toast.success(editing ? "Ticket updated." : "Ticket created.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Ticket" : "New Support Ticket"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              name="subject"
              required
              defaultValue={editing?.subject ?? ""}
              placeholder="Brief description of the issue"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={editing?.description ?? ""}
              placeholder="Detailed description..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="companyId">Company</Label>
              <select
                id="companyId"
                name="companyId"
                className={SELECT_CLASS}
                defaultValue={editing?.companyId ?? ""}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">— none —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="contactId">Contact</Label>
              <select
                id="contactId"
                name="contactId"
                className={SELECT_CLASS}
                defaultValue={editing?.contactId ?? ""}
              >
                <option value="">— none —</option>
                {filteredContacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                name="priority"
                className={SELECT_CLASS}
                defaultValue={editing?.priority ?? "medium"}
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className={SELECT_CLASS}
                defaultValue={editing?.status ?? "open"}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="assignedTo">Assigned To</Label>
              <select
                id="assignedTo"
                name="assignedTo"
                className={SELECT_CLASS}
                defaultValue={editing?.assignedTo ?? ""}
              >
                <option value="">— unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dueAt">Due Date (SLA)</Label>
              <Input
                id="dueAt"
                name="dueAt"
                type="date"
                defaultValue={toDateInputValue(editing?.dueAt ?? null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Create ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
