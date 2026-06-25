"use client";

import {
  useActionState,
  useEffect,
  useState,
  startTransition,
} from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { upsertNumberSeriesAction } from "@/server/actions/number-series";
import {
  numberSeriesSchema,
  DOC_TYPES,
  DOC_TYPE_LABELS,
  RESET_CYCLE_LABELS,
  type DocType,
  type NumberSeriesFormValues,
} from "@/lib/validations/settings";
import type { NumberSeries } from "@/lib/db/schema";
import { SELECT_CLASS } from "@/lib/ui-constants";

const DEFAULT_SERIES = {
  prefix: "",
  padding: 5,
  nextNumber: 1,
  resetCycle: "never",
} as const;

function formatPreview(prefix: string, padding: number, nextNumber: number): string {
  return `${prefix}${String(nextNumber).padStart(padding, "0")}`;
}

// ─── Inline form — remounts via `key` when editing a different doc type ───────

type NumberSeriesFormProps = {
  editingType: DocType;
  currentRow: NumberSeries | null;
  formAction: (formData: FormData) => void;
  saving: boolean;
};

function NumberSeriesForm({
  editingType,
  currentRow,
  formAction,
  saving,
}: NumberSeriesFormProps) {
  const form = useForm<NumberSeriesFormValues>({
    resolver: zodResolver(numberSeriesSchema),
    defaultValues: {
      docType: editingType,
      prefix: currentRow?.prefix ?? DEFAULT_SERIES.prefix,
      padding: currentRow?.padding ?? DEFAULT_SERIES.padding,
      nextNumber: currentRow?.nextNumber ?? DEFAULT_SERIES.nextNumber,
      resetCycle:
        (currentRow?.resetCycle as "never" | "yearly" | "monthly") ??
        DEFAULT_SERIES.resetCycle,
    },
  });

  const [watchedPrefix, watchedPadding, watchedNextNumber] = form.watch([
    "prefix",
    "padding",
    "nextNumber",
  ]);

  const preview = formatPreview(
    watchedPrefix ?? "",
    Number(watchedPadding) || 1,
    Number(watchedNextNumber) || 1
  );

  function onSubmit(values: NumberSeriesFormValues) {
    const fd = new FormData();
    fd.append("docType", values.docType);
    fd.append("prefix", values.prefix);
    fd.append("padding", String(values.padding));
    fd.append("nextNumber", String(values.nextNumber));
    fd.append("resetCycle", values.resetCycle);
    startTransition(() => formAction(fd));
  }

  return (
    <>
      <form
        id="number-series-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 pt-2"
      >
        <input type="hidden" {...form.register("docType")} />

        <div className="space-y-1.5">
          <Label htmlFor="ns-prefix">Prefix</Label>
          <Input
            id="ns-prefix"
            {...form.register("prefix")}
            placeholder="e.g. INV-"
            maxLength={20}
          />
          {form.formState.errors.prefix && (
            <p className="text-xs text-destructive">
              {form.formState.errors.prefix.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ns-padding">Number of Digits</Label>
          <Input
            id="ns-padding"
            type="number"
            min="1"
            max="10"
            {...form.register("padding", { valueAsNumber: true })}
          />
          {form.formState.errors.padding && (
            <p className="text-xs text-destructive">
              {form.formState.errors.padding.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ns-next">Next Number</Label>
          <Input
            id="ns-next"
            type="number"
            min="1"
            {...form.register("nextNumber", { valueAsNumber: true })}
          />
          {form.formState.errors.nextNumber && (
            <p className="text-xs text-destructive">
              {form.formState.errors.nextNumber.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Changing this will affect future document numbering. Ensure there
            are no duplicate numbers in your records.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ns-reset">Reset Cycle</Label>
          <select
            id="ns-reset"
            {...form.register("resetCycle")}
            className={SELECT_CLASS}
          >
            {Object.entries(RESET_CYCLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-md bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">Preview: </span>
          <code className="font-mono font-medium">{preview}</code>
        </div>
      </form>

      <DialogFooter showCloseButton>
        <Button type="submit" form="number-series-form" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Main section component ───────────────────────────────────────────────────

type NumberSeriesSectionProps = {
  initialSeries: NumberSeries[];
};

export function NumberSeriesSection({ initialSeries }: NumberSeriesSectionProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<DocType | null>(null);
  const [state, formAction, saving] = useActionState(
    upsertNumberSeriesAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      setDialogOpen(false);
      router.refresh();
      toast.success("Numbering series saved.");
    }
  }, [state, router]);

  function openEdit(docType: DocType) {
    setEditingType(docType);
    setDialogOpen(true);
  }

  // Merge DB rows with the fixed doc type list — always show all 6
  const rows = DOC_TYPES.map((docType) => ({
    docType,
    row: initialSeries.find((s) => s.docType === docType) ?? null,
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure the prefix, digit padding, and reset cycle for each document
        type. Changes apply to new documents only.
      </p>

      <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? `Edit — ${DOC_TYPE_LABELS[editingType]}` : "Edit"}
            </DialogTitle>
          </DialogHeader>
          {editingType && (
            <NumberSeriesForm
              key={editingType}
              editingType={editingType}
              currentRow={rows.find((r) => r.docType === editingType)?.row ?? null}
              formAction={formAction}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document Type</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Preview</TableHead>
            <TableHead>Next #</TableHead>
            <TableHead>Reset</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ docType, row }) => {
            const prefix = row?.prefix ?? DEFAULT_SERIES.prefix;
            const padding = row?.padding ?? DEFAULT_SERIES.padding;
            const nextNumber = row?.nextNumber ?? DEFAULT_SERIES.nextNumber;
            const resetCycle = row?.resetCycle ?? DEFAULT_SERIES.resetCycle;
            return (
              <TableRow key={docType}>
                <TableCell className="font-medium">
                  {DOC_TYPE_LABELS[docType]}
                </TableCell>
                <TableCell>
                  {prefix ? (
                    <code className="text-xs">{prefix}</code>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <code className="text-xs">
                    {formatPreview(prefix, padding, nextNumber)}
                  </code>
                </TableCell>
                <TableCell>{nextNumber}</TableCell>
                <TableCell>
                  {RESET_CYCLE_LABELS[resetCycle] ?? resetCycle}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(docType)}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {state && !state.success && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </div>
  );
}
