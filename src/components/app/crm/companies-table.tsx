"use client";

import { useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus, Pencil } from "lucide-react";

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
import { createCompanyAction, updateCompanyAction } from "@/server/actions/crm/companies";

type Company = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  createdAt: Date;
};

type State = { success: true } | { success: false; error: string } | null;

function CompanyDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Company | null;
}) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<State, FormData>(createCompanyAction, null);
  const [updateState, updateAction, updatePending] = useActionState<State, FormData>(updateCompanyAction, null);
  const state = editing ? updateState : createState;
  const action = editing ? updateAction : createAction;
  const pending = editing ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editing ? "Company updated." : "Company created.");
    }
  }, [state, editing, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Company" : "New Company"}</DialogTitle>
        </DialogHeader>
        <form id="company-form" action={action} className="space-y-4 pt-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="co-name">Name</Label>
            <Input id="co-name" name="name" required defaultValue={editing?.name ?? ""} placeholder="Acme Corp" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-industry">Industry</Label>
            <Input id="co-industry" name="industry" defaultValue={editing?.industry ?? ""} placeholder="Technology" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-website">Website</Label>
            <Input id="co-website" name="website" defaultValue={editing?.website ?? ""} placeholder="https://acme.com" />
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="company-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  companies: Company[];
  canCreate: boolean;
  canEdit: boolean;
};

export function CompaniesTable({ companies, canCreate, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(company: Company) {
    setEditing(company);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canCreate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" /> New Company
          </Button>
        )}
      </div>

      {companies.length === 0 ? (
        <EmptyState icon={Building2} title="No companies yet" description="Add your first CRM company." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Website</TableHead>
              {canEdit && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.industry ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {c.website ? (
                    <a href={c.website} target="_blank" rel="noreferrer" className="text-primary underline text-sm">
                      {c.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
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

      <CompanyDialog key={dialogKey} open={open} onOpenChange={setOpen} editing={editing} />
    </>
  );
}
