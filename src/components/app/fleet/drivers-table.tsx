"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserRound, Plus, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDriverAction,
  updateDriverAction,
  toggleDriverActiveAction,
} from "@/server/actions/fleet/drivers";

type Driver = {
  id: string;
  name: string;
  licenseNo: string | null;
  licenseExpiry: string | null;
  phone: string | null;
  isActive: boolean;
};

type State = { success: true } | { success: false; error: string } | null;

function DriverDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Driver | null;
}) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<State, FormData>(createDriverAction, null);
  const [updateState, updateAction, updatePending] = useActionState<State, FormData>(updateDriverAction, null);
  const state = editing ? updateState : createState;
  const action = editing ? updateAction : createAction;
  const pending = editing ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editing ? "Driver updated." : "Driver created.");
    }
  }, [state, editing, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Driver" : "New Driver"}</DialogTitle>
        </DialogHeader>
        <form id="driver-form" action={action} className="space-y-4 pt-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="drv-name">Full Name *</Label>
            <Input id="drv-name" name="name" required defaultValue={editing?.name ?? ""} placeholder="John Smith" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drv-license">License Number</Label>
            <Input id="drv-license" name="licenseNo" defaultValue={editing?.licenseNo ?? ""} placeholder="DL-12345" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drv-expiry">License Expiry</Label>
            <Input id="drv-expiry" name="licenseExpiry" type="date" defaultValue={editing?.licenseExpiry ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drv-phone">Phone</Label>
            <Input id="drv-phone" name="phone" defaultValue={editing?.phone ?? ""} placeholder="+971-50-000-0000" />
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="driver-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  drivers: Driver[];
  canCreate: boolean;
  canEdit: boolean;
};

export function DriversTable({ drivers, canCreate, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(d: Driver) {
    setEditing(d);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function handleToggle(id: string, current: boolean) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const res = await toggleDriverActiveAction(id, !current);
      setPendingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      if (res.success) { router.refresh(); toast.success(current ? "Driver deactivated." : "Driver activated."); }
      else toast.error(res.error ?? "Failed.");
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="flex justify-end mb-4">
        {canCreate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" /> New Driver
          </Button>
        )}
      </div>

      {drivers.length === 0 ? (
        <EmptyState icon={UserRound} title="No drivers" description="Add your first driver." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>License #</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.map((d) => {
              const licenseExpired = d.licenseExpiry ? d.licenseExpiry < today : false;
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.licenseNo ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {d.licenseExpiry ? (
                      <span className={licenseExpired ? "text-destructive font-medium" : ""}>{d.licenseExpiry}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{d.phone ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <Badge className={d.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}>
                      {d.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pendingIds.has(d.id)}
                        onClick={() => handleToggle(d.id, d.isActive)}
                        className="text-xs"
                      >
                        {d.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <DriverDialog key={dialogKey} open={open} onOpenChange={setOpen} editing={editing} />
    </>
  );
}
