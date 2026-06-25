"use client";

import {
  useActionState,
  useTransition,
  useEffect,
  useState,
  startTransition,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Percent } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveTaxRateAction, setTaxRateActiveAction } from "@/server/actions/tax-rates";
import {
  taxRateSchema,
  TAX_TYPES,
  TAX_TYPE_LABELS,
  type TaxType,
  type TaxRateFormValues,
} from "@/lib/validations/settings";
import type { TaxRate } from "@/lib/db/schema";
import { SELECT_CLASS } from "@/lib/ui-constants";

// ─── Inline form component — remounts via `key` when switching create vs edit ─

type TaxRateFormProps = {
  editingRate: TaxRate | null;
  formAction: (formData: FormData) => void;
  saving: boolean;
};

function TaxRateForm({ editingRate, formAction, saving }: TaxRateFormProps) {
  const form = useForm<TaxRateFormValues>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: {
      id: editingRate?.id ?? "",
      name: editingRate?.name ?? "",
      rate: editingRate ? parseFloat(editingRate.rate) : 0,
      type: (editingRate?.type as TaxType) ?? "gst",
    },
  });

  function onSubmit(values: TaxRateFormValues) {
    const fd = new FormData();
    fd.append("id", values.id ?? "");
    fd.append("name", values.name);
    fd.append("rate", String(values.rate));
    fd.append("type", values.type);
    startTransition(() => formAction(fd));
  }

  return (
    <>
      <form
        id="tax-rate-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 pt-2"
      >
        <div className="space-y-1.5">
          <Label htmlFor="tax-name">Name</Label>
          <Input
            id="tax-name"
            {...form.register("name")}
            placeholder="e.g. GST 17%"
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tax-rate">Rate (%)</Label>
          <Input
            id="tax-rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            {...form.register("rate", { valueAsNumber: true })}
          />
          {form.formState.errors.rate && (
            <p className="text-xs text-destructive">
              {form.formState.errors.rate.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tax-type">Type</Label>
          <select
            id="tax-type"
            {...form.register("type")}
            className={SELECT_CLASS}
          >
            {TAX_TYPES.map((t) => (
              <option key={t} value={t}>
                {TAX_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          GL account linking will be available after Chart of Accounts is set up (Epic 5).
        </p>
      </form>

      <DialogFooter showCloseButton>
        <Button type="submit" form="tax-rate-form" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Main section component ───────────────────────────────────────────────────

type TaxRatesSectionProps = {
  initialTaxRates: TaxRate[];
};

export function TaxRatesSection({ initialTaxRates }: TaxRatesSectionProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [togglePending, setTogglePending] = useState<string | null>(null);
  const [, startToggleTransition] = useTransition();
  const [state, formAction, saving] = useActionState(saveTaxRateAction, null);

  useEffect(() => {
    if (state?.success) {
      setDialogOpen(false);
      router.refresh();
      toast.success(editingRate ? "Tax rate updated." : "Tax rate created.");
    }
  }, [state, router]);

  function openNew() {
    setEditingRate(null);
    setDialogOpen(true);
  }

  function openEdit(rate: TaxRate) {
    setEditingRate(rate);
    setDialogOpen(true);
  }

  function handleToggle(id: string, currentlyActive: boolean) {
    setTogglePending(id);
    startToggleTransition(async () => {
      const result = await setTaxRateActiveAction(id, !currentlyActive);
      setTogglePending(null);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update status.");
      } else {
        router.refresh();
        toast.success(
          currentlyActive ? "Tax rate deactivated." : "Tax rate activated."
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define the tax rates available for invoices, bills, and purchase orders.
        </p>
        <Button size="sm" onClick={openNew}>
          New Tax Rate
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRate ? "Edit Tax Rate" : "New Tax Rate"}
            </DialogTitle>
          </DialogHeader>
          <TaxRateForm
            key={editingRate?.id ?? "new"}
            editingRate={editingRate}
            formAction={formAction}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {initialTaxRates.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="No tax rates yet"
          description="Add your first tax rate to use it on invoices and bills."
          action={
            <Button size="sm" onClick={openNew}>
              Add Tax Rate
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialTaxRates.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell className="font-medium">{rate.name}</TableCell>
                <TableCell>{parseFloat(rate.rate).toFixed(2)}%</TableCell>
                <TableCell>
                  {TAX_TYPE_LABELS[rate.type as TaxType] ?? rate.type}
                </TableCell>
                <TableCell>
                  {rate.isActive ? (
                    <Badge variant="outline">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(rate)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={togglePending === rate.id}
                      onClick={() => handleToggle(rate.id, rate.isActive)}
                    >
                      {togglePending === rate.id
                        ? "…"
                        : rate.isActive
                          ? "Deactivate"
                          : "Activate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {state && !state.success && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </div>
  );
}
