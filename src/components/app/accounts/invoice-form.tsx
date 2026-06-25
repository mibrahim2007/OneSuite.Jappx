"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { createInvoiceAction, updateInvoiceAction } from "@/server/actions/invoices";
import { saveInvoiceSchema, type SaveInvoiceValues } from "@/lib/validations/invoices";
import type {
  Account,
  Invoice,
  InvoiceLine,
  Contact,
  FiscalPeriod,
  TaxRate,
} from "@/lib/db/schema";

type InvoiceFormProps = {
  customers: Contact[];
  accounts: Account[];
  openPeriods: FiscalPeriod[];
  taxRates: TaxRate[];
  initialData?: Invoice & { lines: InvoiceLine[] };
};

const ACCOUNT_TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

const defaultLine = { accountId: "", description: "", amount: 0, taxRateId: "" };

export function InvoiceForm({
  customers,
  accounts,
  openPeriods,
  taxRates,
  initialData,
}: InvoiceFormProps) {
  const router = useRouter();
  const [isSaving, startTransition] = useTransition();
  const isEdit = !!initialData;

  const form = useForm<SaveInvoiceValues>({
    resolver: zodResolver(saveInvoiceSchema),
    defaultValues: isEdit
      ? {
          customerId: initialData.customerId,
          invoiceDate: initialData.invoiceDate,
          dueDate: initialData.dueDate,
          periodId: initialData.periodId ?? "",
          reference: initialData.reference ?? "",
          notes: initialData.notes ?? "",
          receivableAccountId: initialData.receivableAccountId,
          lines: initialData.lines.map((l) => ({
            accountId: l.accountId,
            description: l.description ?? "",
            amount: parseFloat(l.amount),
            taxRateId: l.taxRateId ?? "",
          })),
        }
      : {
          customerId: "",
          invoiceDate: todayString(),
          dueDate: todayString(),
          periodId: openPeriods[0]?.id ?? "",
          reference: "",
          notes: "",
          receivableAccountId: "",
          lines: [defaultLine],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedDate = form.watch("invoiceDate");

  // Auto-select period matching invoice date
  useEffect(() => {
    if (!watchedDate) return;
    const match = openPeriods.find(
      (p) => p.startDate <= watchedDate && watchedDate <= p.endDate
    );
    if (match) {
      form.setValue("periodId", match.id);
    } else {
      form.setValue("periodId", openPeriods[0]?.id ?? "");
    }
  }, [watchedDate, openPeriods, form]);

  // Grouped accounts for income lines (exclude bank accounts)
  const incomeGroupedAccounts = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const type of ACCOUNT_TYPE_ORDER) {
      map.set(type, []);
    }
    for (const account of accounts) {
      if (account.isBank) continue;
      const type = account.type.toLowerCase();
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(account);
    }
    return map;
  }, [accounts]);

  // Asset accounts only for the AR receivable account
  const assetAccounts = useMemo(
    () => accounts.filter((a) => a.type === "asset"),
    [accounts]
  );

  // Tax rate lookup map for live tax computation display
  const taxRateMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const tr of taxRates) {
      m.set(tr.id, parseFloat(tr.rate));
    }
    return m;
  }, [taxRates]);

  // Watch all lines for live totals
  const watchedLines = form.watch("lines");

  const { subtotal, taxTotal, grandTotal } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    for (const line of watchedLines) {
      const amt = Number(line.amount) || 0;
      sub += amt;
      if (line.taxRateId) {
        const rate = taxRateMap.get(line.taxRateId) ?? 0;
        tax += amt * (rate / 100);
      }
    }
    return { subtotal: sub, taxTotal: tax, grandTotal: sub + tax };
  }, [watchedLines, taxRateMap]);

  function onSubmit(values: SaveInvoiceValues) {
    startTransition(async () => {
      try {
        const result = isEdit
          ? await updateInvoiceAction(initialData.id, values)
          : await createInvoiceAction(values);

        if (result.success) {
          toast.success(isEdit ? "Invoice updated." : "Invoice created.");
          router.push("/app/accounts/invoices");
        } else {
          toast.error(result.error ?? "Failed to save invoice.");
        }
      } catch {
        toast.error("Failed to save invoice.");
      }
    });
  }

  const errors = form.formState.errors;
  const hasOpenPeriods = openPeriods.length > 0;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl">
      {!hasOpenPeriods && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          No open fiscal periods found. Create and open a fiscal period before
          saving invoices.
        </div>
      )}

      {/* Header fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="customerId">Customer</Label>
          <select
            id="customerId"
            className={SELECT_CLASS}
            {...form.register("customerId")}
          >
            <option value="">— Select customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.code ? ` (${c.code})` : ""}
              </option>
            ))}
          </select>
          {errors.customerId && (
            <p className="text-xs text-destructive">{errors.customerId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invoiceDate">Invoice Date</Label>
          <Input id="invoiceDate" type="date" {...form.register("invoiceDate")} />
          {errors.invoiceDate && (
            <p className="text-xs text-destructive">{errors.invoiceDate.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input id="dueDate" type="date" {...form.register("dueDate")} />
          {errors.dueDate && (
            <p className="text-xs text-destructive">{errors.dueDate.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="periodId">Fiscal Period</Label>
          <select
            id="periodId"
            className={SELECT_CLASS}
            disabled={!hasOpenPeriods}
            {...form.register("periodId")}
          >
            {!hasOpenPeriods && <option value="">No open periods</option>}
            {openPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {errors.periodId && (
            <p className="text-xs text-destructive">{errors.periodId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reference">Reference (Customer PO #)</Label>
          <Input
            id="reference"
            placeholder="e.g. PO-2025-001"
            {...form.register("reference")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="receivableAccountId">AR Account (Receivable)</Label>
          <select
            id="receivableAccountId"
            className={SELECT_CLASS}
            {...form.register("receivableAccountId")}
          >
            <option value="">— Select asset account —</option>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          {errors.receivableAccountId && (
            <p className="text-xs text-destructive">
              {errors.receivableAccountId.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            placeholder="Optional internal notes"
            {...form.register("notes")}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Line Items</h2>

        <div className="grid grid-cols-[1fr_160px_100px_140px_80px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
          <span>Account</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span>Tax Rate</span>
          <span className="text-right">Tax</span>
          <span />
        </div>

        {fields.map((field, index) => {
          const lineAmt = Number(watchedLines[index]?.amount) || 0;
          const trId = watchedLines[index]?.taxRateId;
          const rate = trId ? (taxRateMap.get(trId) ?? 0) : 0;
          const lineTax = lineAmt * (rate / 100);

          return (
            <div
              key={field.id}
              className="grid grid-cols-[1fr_160px_100px_140px_80px_36px] gap-2 items-start"
            >
              <div>
                <select
                  className={SELECT_CLASS}
                  {...form.register(`lines.${index}.accountId`)}
                >
                  <option value="">— Select account —</option>
                  {Array.from(incomeGroupedAccounts.entries()).map(
                    ([type, accts]) =>
                      accts.length === 0 ? null : (
                        <optgroup
                          key={type}
                          label={ACCOUNT_TYPE_LABELS[type] ?? type}
                        >
                          {accts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </optgroup>
                      )
                  )}
                </select>
                {errors.lines?.[index]?.accountId && (
                  <p className="text-xs text-destructive mt-0.5">
                    {errors.lines[index]?.accountId?.message}
                  </p>
                )}
              </div>

              <Input
                placeholder="Description"
                {...form.register(`lines.${index}.description`)}
              />

              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="text-right"
                {...form.register(`lines.${index}.amount`, {
                  valueAsNumber: true,
                })}
              />
              {errors.lines?.[index]?.amount && (
                <p className="text-xs text-destructive col-start-3">
                  {errors.lines[index]?.amount?.message}
                </p>
              )}

              <select
                className={SELECT_CLASS}
                {...form.register(`lines.${index}.taxRateId`)}
              >
                <option value="">No tax</option>
                {taxRates.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name} ({parseFloat(tr.rate).toFixed(2)}%)
                  </option>
                ))}
              </select>

              {/* Tax amount — display only, computed client-side for UX */}
              <div className="flex items-center justify-end text-sm tabular-nums text-muted-foreground h-8 px-1">
                {lineTax > 0 ? lineTax.toFixed(2) : "—"}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                disabled={fields.length <= 1}
                onClick={() => remove(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(defaultLine)}
        >
          + Add Line
        </Button>
      </div>

      {errors.lines?.root && (
        <p className="text-sm text-destructive">{errors.lines.root.message}</p>
      )}

      {/* Totals */}
      <div className="rounded-md border bg-muted/40 p-3 max-w-xs ml-auto">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-mono">{taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span className="font-mono">{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSaving || !hasOpenPeriods}>
          {isSaving ? "Saving…" : isEdit ? "Update Invoice" : "Save Draft"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/app/accounts/invoices")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
