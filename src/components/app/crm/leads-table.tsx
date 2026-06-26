"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flame, Plus, Pencil, Trash2 } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { createLeadAction, updateLeadAction, updateLeadStatusAction, deleteLeadAction } from "@/server/actions/crm/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/validations/crm";
import { exportToCsv } from "@/lib/utils/export-csv";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  score: number | null;
  status: "new" | "contacted" | "qualified" | "unqualified" | "converted";
  createdAt: Date;
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-green-100 text-green-800",
  unqualified: "bg-gray-100 text-gray-700",
  converted: "bg-purple-100 text-purple-800",
};

type State = { success: true } | { success: false; error: string } | null;

function LeadDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Lead | null;
}) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<State, FormData>(createLeadAction, null);
  const [updateState, updateAction, updatePending] = useActionState<State, FormData>(updateLeadAction, null);
  const state = editing ? updateState : createState;
  const action = editing ? updateAction : createAction;
  const pending = editing ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editing ? "Lead updated." : "Lead created.");
    }
  }, [state, editing, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Lead" : "New Lead"}</DialogTitle>
        </DialogHeader>
        <form id="lead-form" action={action} className="space-y-4 pt-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="ld-name">Lead Name</Label>
            <Input id="ld-name" name="name" required defaultValue={editing?.name ?? ""} placeholder="John Smith" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ld-company">Company</Label>
            <Input id="ld-company" name="company" defaultValue={editing?.company ?? ""} placeholder="Acme Corp" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ld-email">Email</Label>
            <Input id="ld-email" name="email" type="email" defaultValue={editing?.email ?? ""} placeholder="john@acme.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ld-phone">Phone</Label>
            <Input id="ld-phone" name="phone" defaultValue={editing?.phone ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ld-source">Source</Label>
            <Input id="ld-source" name="source" defaultValue={editing?.source ?? ""} placeholder="Website, Referral…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ld-score">Score (0–100)</Label>
            <Input id="ld-score" name="score" type="number" min="0" max="100" defaultValue={editing?.score ?? 0} />
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="lead-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  leads: Lead[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export function LeadsTable({ leads, canCreate, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function handleStatusChange(lead: Lead, status: LeadStatus) {
    setPendingId(lead.id + status);
    startTransition(async () => {
      const res = await updateLeadStatusAction(lead.id, status);
      if (res.success) router.refresh();
      else toast.error(res.error);
      setPendingId(null);
    });
  }

  function handleDelete(lead: Lead) {
    setPendingId(lead.id + "del");
    startTransition(async () => {
      const res = await deleteLeadAction(lead.id);
      if (res.success) { toast.success("Lead deleted."); router.refresh(); }
      else toast.error(res.error);
      setPendingId(null);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div />
        <div className="flex items-center gap-2">
          {leads.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCsv("leads", leads as unknown as Record<string, unknown>[], [
                  { key: "name", label: "Name" },
                  { key: "company", label: "Company" },
                  { key: "email", label: "Email" },
                  { key: "phone", label: "Phone" },
                  { key: "source", label: "Source" },
                  { key: "score", label: "Score" },
                  { key: "status", label: "Status" },
                ])
              }
            >
              Export CSV
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4 mr-1" /> New Lead
            </Button>
          )}
        </div>
      </div>

      {leads.length === 0 ? (
        <EmptyState icon={Flame} title="No leads yet" description="Add your first lead to get started." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              {(canEdit || canDelete) && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell>{l.company ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{l.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{l.source ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{l.score ?? 0}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <select
                      className={SELECT_CLASS}
                      value={l.status}
                      disabled={pendingId === l.id + l.status}
                      onChange={(e) => handleStatusChange(l, e.target.value as LeadStatus)}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[l.status]}`}>
                      {l.status}
                    </span>
                  )}
                </TableCell>
                {(canEdit || canDelete) && (
                  <TableCell className="flex gap-1">
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(l)} disabled={pendingId === l.id + "del"}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <LeadDialog key={dialogKey} open={open} onOpenChange={setOpen} editing={editing} />
    </>
  );
}
