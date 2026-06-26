"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { saveGlMappingsAction } from "@/server/actions/costs/gl-mappings";

type Account = { id: string; code: string; name: string };

const MAPPING_FIELDS = [
  { key: "fleet_fuel_expense", label: "Fleet Fuel Expense Account", hint: "Debited when fuel costs are posted" },
  { key: "fleet_payable", label: "Fleet Payable Account", hint: "Credited when fuel costs are posted" },
  { key: "wo_maintenance_expense", label: "WO Maintenance Expense Account", hint: "Debited when work order costs are posted" },
  { key: "wo_payable", label: "WO Payable Account", hint: "Credited when work order costs are posted" },
] as const;

export function GlMappingsForm({
  mappings,
  accounts,
  canEdit,
}: {
  mappings: Record<string, string>;
  accounts: Account[];
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(saveGlMappingsAction, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) toast.success("GL mappings saved.");
    else toast.error(state.error ?? "Failed to save.");
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {MAPPING_FIELDS.map(({ key, label, hint }) => (
        <div key={key}>
          <label className="block text-sm font-medium mb-1">{label}</label>
          <p className="text-xs text-muted-foreground mb-2">{hint}</p>
          <select
            name={key}
            defaultValue={mappings[key] ?? ""}
            disabled={!canEdit}
            className={SELECT_CLASS}
          >
            <option value="">— Not configured —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
      ))}

      {canEdit && (
        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save Mappings"}
          </button>
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-muted-foreground">You do not have permission to edit these settings.</p>
      )}
    </form>
  );
}
