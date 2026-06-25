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
import { postJournalAction } from "@/server/actions/journal-entries";
import {
  postJournalSchema,
  type PostJournalValues,
} from "@/lib/validations/journal-entry";
import type { Account, FiscalPeriod } from "@/lib/db/schema";

type JournalEntryFormProps = {
  accounts: Account[];
  openPeriods: FiscalPeriod[];
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

const ACCOUNT_TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];

const defaultLine = { accountId: "", description: "", debit: 0, credit: 0 };

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function JournalEntryForm({ accounts, openPeriods }: JournalEntryFormProps) {
  const router = useRouter();
  const [isPosting, startTransition] = useTransition();

  const form = useForm<PostJournalValues>({
    resolver: zodResolver(postJournalSchema),
    defaultValues: {
      entryDate: todayString(),
      periodId: openPeriods[0]?.id ?? "",
      reference: "",
      memo: "",
      lines: [defaultLine, defaultLine],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedDate = form.watch("entryDate");

  useEffect(() => {
    if (!watchedDate) return;
    const match = openPeriods.find(
      (p) => p.startDate <= watchedDate && watchedDate <= p.endDate
    );
    if (match) {
      form.setValue("periodId", match.id);
    } else {
      form.setValue("periodId", "");
    }
  }, [watchedDate, openPeriods, form]);

  const groupedAccounts = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const type of ACCOUNT_TYPE_ORDER) {
      map.set(type, []);
    }
    for (const account of accounts) {
      const type = account.type.toLowerCase();
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(account);
    }
    return map;
  }, [accounts]);

  const watchedLines = form.watch("lines");
  const totalDebit = watchedLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = watchedLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.001;

  function onSubmit(values: PostJournalValues) {
    startTransition(async () => {
      const result = await postJournalAction(values);
      if (result.success) {
        toast.success(`Journal ${result.journalNo} posted.`);
        router.push("/app/accounts/journal-entries");
      } else {
        toast.error(result.error ?? "Failed to post journal.");
      }
    });
  }

  const errors = form.formState.errors;
  const hasOpenPeriods = openPeriods.length > 0;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl">
      {!hasOpenPeriods && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          No open fiscal periods found. Create and open a fiscal period before posting
          journal entries.
        </div>
      )}

      {/* Header fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="entryDate">Entry Date</Label>
          <Input
            id="entryDate"
            type="date"
            {...form.register("entryDate")}
          />
          {errors.entryDate && (
            <p className="text-xs text-destructive">{errors.entryDate.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="periodId">Fiscal Period</Label>
          <select
            id="periodId"
            className={SELECT_CLASS}
            {...form.register("periodId")}
            disabled={!hasOpenPeriods}
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
          <Label htmlFor="reference">Reference</Label>
          <Input
            id="reference"
            placeholder="e.g. INV-001"
            {...form.register("reference")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="memo">Memo</Label>
          <Input
            id="memo"
            placeholder="Brief description"
            {...form.register("memo")}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_120px_120px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
          <span>Account</span>
          <span>Description</span>
          <span className="text-right">Debit</span>
          <span className="text-right">Credit</span>
          <span />
        </div>

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-[1fr_1fr_120px_120px_36px] gap-2 items-start"
          >
            <div>
              <select
                className={SELECT_CLASS}
                {...form.register(`lines.${index}.accountId`)}
              >
                <option value="">— Select account —</option>
                {Array.from(groupedAccounts.entries()).map(([type, accts]) =>
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
              {errors.lines?.[index]?.root && (
                <p className="text-xs text-destructive mt-0.5">
                  {errors.lines[index]?.root?.message}
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
              min="0"
              placeholder="0.00"
              className="text-right"
              {...form.register(`lines.${index}.debit`, { valueAsNumber: true })}
            />

            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="text-right"
              {...form.register(`lines.${index}.credit`, { valueAsNumber: true })}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              disabled={fields.length <= 2}
              onClick={() => remove(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(defaultLine)}
        >
          + Add Line
        </Button>
      </div>

      {/* Totals summary */}
      <div className="rounded-md border bg-muted/40 p-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Debits</span>
            <p className="font-mono font-medium">{totalDebit.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Total Credits</span>
            <p className="font-mono font-medium">{totalCredit.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Difference</span>
            <p
              className={`font-mono font-medium ${
                isBalanced ? "text-green-600" : "text-destructive"
              }`}
            >
              {difference.toFixed(2)}
            </p>
          </div>
        </div>
        {!isBalanced && (totalDebit > 0 || totalCredit > 0) && (
          <p className="mt-2 text-xs text-destructive">
            Journal is unbalanced — debits must equal credits before posting.
          </p>
        )}
      </div>

      {errors.lines?.root && (
        <p className="text-sm text-destructive">{errors.lines.root.message}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPosting || !hasOpenPeriods}>
          {isPosting ? "Posting…" : "Post Journal"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/app/accounts/journal-entries")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
