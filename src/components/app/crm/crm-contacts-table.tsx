"use client";

import { useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Contact, Plus, Pencil } from "lucide-react";

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
import { createCrmContactAction, updateCrmContactAction } from "@/server/actions/crm/contacts";

type ContactRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: Date;
};

type CompanyOption = { id: string; name: string };

type State = { success: true } | { success: false; error: string } | null;

function ContactDialog({
  open,
  onOpenChange,
  editing,
  companies,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ContactRow | null;
  companies: CompanyOption[];
}) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<State, FormData>(createCrmContactAction, null);
  const [updateState, updateAction, updatePending] = useActionState<State, FormData>(updateCrmContactAction, null);
  const state = editing ? updateState : createState;
  const action = editing ? updateAction : createAction;
  const pending = editing ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editing ? "Contact updated." : "Contact created.");
    }
  }, [state, editing, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>
        <form id="contact-form" action={action} className="space-y-4 pt-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="ct-name">Full Name</Label>
            <Input id="ct-name" name="fullName" required defaultValue={editing?.fullName ?? ""} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-company">Company</Label>
            <select name="companyId" id="ct-company" className={`w-full ${SELECT_CLASS}`} defaultValue={editing?.companyId ?? ""}>
              <option value="">— None —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-designation">Designation</Label>
            <Input id="ct-designation" name="designation" defaultValue={editing?.designation ?? ""} placeholder="CEO" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-email">Email</Label>
            <Input id="ct-email" name="email" type="email" defaultValue={editing?.email ?? ""} placeholder="jane@acme.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-phone">Phone</Label>
            <Input id="ct-phone" name="phone" defaultValue={editing?.phone ?? ""} placeholder="+92 300 1234567" />
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="contact-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  contacts: ContactRow[];
  companies: CompanyOption[];
  canCreate: boolean;
  canEdit: boolean;
};

export function CrmContactsTable({ contacts, companies, canCreate, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(contact: ContactRow) {
    setEditing(contact);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canCreate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" /> New Contact
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <EmptyState icon={Contact} title="No contacts yet" description="Add your first CRM contact." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              {canEdit && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.fullName}</TableCell>
                <TableCell>{c.companyName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{c.designation ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{c.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{c.phone ?? <span className="text-muted-foreground">—</span>}</TableCell>
                {canEdit && (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ContactDialog key={dialogKey} open={open} onOpenChange={setOpen} editing={editing} companies={companies} />
    </>
  );
}
