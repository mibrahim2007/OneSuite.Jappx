"use client";

import { useActionState, useEffect, startTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWarehouseAction, updateWarehouseAction } from "@/server/actions/inventory/warehouses";
import { warehouseSchema, updateWarehouseSchema, type WarehouseFormValues } from "@/lib/validations/inventory";
import type { Warehouse } from "@/lib/db/schema";

type WarehouseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingWarehouse: Warehouse | null;
};

type ActionState = { success: true } | { success: false; error: string } | null;

function CreateWarehouseForm({ formAction }: { formAction: (formData: FormData) => void }) {
  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { code: "", name: "", location: "" },
  });

  function onSubmit(values: WarehouseFormValues) {
    const fd = new FormData();
    fd.append("code", values.code.toUpperCase());
    fd.append("name", values.name);
    fd.append("location", values.location ?? "");
    startTransition(() => formAction(fd));
  }

  return (
    <form id="warehouse-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="wh-code">Code</Label>
        <Input
          id="wh-code"
          {...form.register("code")}
          placeholder="e.g. WH-MAIN"
          className="uppercase"
          onChange={(e) => form.setValue("code", e.target.value.toUpperCase())}
        />
        {form.formState.errors.code && (
          <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wh-name">Name</Label>
        <Input id="wh-name" {...form.register("name")} placeholder="e.g. Main Warehouse" />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wh-location">Location (optional)</Label>
        <Input id="wh-location" {...form.register("location")} placeholder="e.g. Block A, Industrial Area" />
      </div>
    </form>
  );
}

function EditWarehouseForm({
  warehouse,
  formAction,
}: {
  warehouse: Warehouse;
  formAction: (formData: FormData) => void;
}) {
  type EditValues = { name: string; location?: string | null };
  const form = useForm<EditValues>({
    resolver: zodResolver(updateWarehouseSchema),
    defaultValues: { name: warehouse.name, location: warehouse.location ?? "" },
  });

  function onSubmit(values: EditValues) {
    const fd = new FormData();
    fd.append("id", warehouse.id);
    fd.append("name", values.name);
    fd.append("location", values.location ?? "");
    startTransition(() => formAction(fd));
  }

  return (
    <form id="warehouse-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="wh-code">Code</Label>
        <Input id="wh-code" value={warehouse.code} readOnly className="bg-muted" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wh-name">Name</Label>
        <Input id="wh-name" {...form.register("name")} placeholder="e.g. Main Warehouse" />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wh-location">Location (optional)</Label>
        <Input id="wh-location" {...form.register("location")} placeholder="e.g. Block A, Industrial Area" />
      </div>
    </form>
  );
}

export function WarehouseDialog({ open, onOpenChange, editingWarehouse }: WarehouseDialogProps) {
  const router = useRouter();
  const [createState, createFormAction, createPending] = useActionState<ActionState, FormData>(
    createWarehouseAction,
    null
  );
  const [updateState, updateFormAction, updatePending] = useActionState<ActionState, FormData>(
    updateWarehouseAction,
    null
  );

  const state = editingWarehouse ? updateState : createState;
  const formAction = editingWarehouse ? updateFormAction : createFormAction;
  const isPending = editingWarehouse ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editingWarehouse ? "Warehouse updated." : "Warehouse created.");
    }
  }, [state, editingWarehouse, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingWarehouse ? "Edit Warehouse" : "New Warehouse"}</DialogTitle>
        </DialogHeader>

        {editingWarehouse ? (
          <EditWarehouseForm
            key={editingWarehouse.id}
            warehouse={editingWarehouse}
            formAction={formAction}
          />
        ) : (
          <CreateWarehouseForm key="new" formAction={formAction} />
        )}

        {state && !state.success && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <DialogFooter showCloseButton>
          <Button type="submit" form="warehouse-form" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
