"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

import { upsertSalaryStructureAction } from "@/server/actions/hrm/payroll";
import { SELECT_CLASS } from "@/lib/ui-constants";
import type { SalaryStructure } from "@/lib/db/schema";

type EmpOption = { id: string; fullName: string; empCode: string };
type StructRow = Pick<
  SalaryStructure,
  "id" | "employeeId" | "effectiveFrom" | "basic" | "allowances" | "deductions" | "gross"
>;

type Props = {
  employees: EmpOption[];
  structures: StructRow[];
  canManage: boolean;
};

type AllowanceItem = { name: string; amount: number };

export function SalaryStructuresView({ employees, structures, canManage }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [allowances, setAllowances] = useState<AllowanceItem[]>([]);
  const [deductions, setDeductions] = useState<AllowanceItem[]>([]);
  const [dialogKey, setDialogKey] = useState(0);

  const [state, formAction, isPending] = useActionState(upsertSalaryStructureAction, null);

  const empMap = new Map(employees.map((e) => [e.id, e]));

  function openNew() {
    setSelectedEmployee("");
    setAllowances([]);
    setDeductions([]);
    setDialogKey((k) => k + 1);
    setShowForm(true);
  }

  function openEdit(s: StructRow) {
    setSelectedEmployee(s.employeeId);
    setAllowances((s.allowances as AllowanceItem[]) ?? []);
    setDeductions((s.deductions as AllowanceItem[]) ?? []);
    setDialogKey((k) => k + 1);
    setShowForm(true);
  }

  if (state?.success === true && showForm) {
    toast.success("Salary structure saved.");
    setShowForm(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Salary Structures</h1>
        {canManage && (
          <button
            onClick={openNew}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + New Structure
          </button>
        )}
      </div>

      {showForm && canManage && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">
            {selectedEmployee ? "Edit Structure" : "New Structure"}
          </h2>
          <form key={dialogKey} action={formAction} className="space-y-4">
            <input type="hidden" name="allowances" value={JSON.stringify(allowances)} />
            <input type="hidden" name="deductions" value={JSON.stringify(deductions)} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Employee *</label>
                <select
                  name="employeeId"
                  defaultValue={selectedEmployee}
                  required
                  className={SELECT_CLASS}
                >
                  <option value="">Select employee…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.empCode} — {e.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Effective From *</label>
                <input
                  type="date"
                  name="effectiveFrom"
                  required
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Basic Salary *</label>
                <input
                  type="number"
                  name="basic"
                  min="0"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
              </div>
            </div>

            {/* Allowances */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Allowances</span>
                <button
                  type="button"
                  onClick={() => setAllowances((a) => [...a, { name: "", amount: 0 }])}
                  className="text-xs text-primary hover:underline"
                >
                  + Add
                </button>
              </div>
              {allowances.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      setAllowances((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder="Name"
                    className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) =>
                      setAllowances((a) =>
                        a.map((x, j) => (j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))
                      )
                    }
                    placeholder="Amount"
                    className="flex h-8 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setAllowances((a) => a.filter((_, j) => j !== i))}
                    className="text-destructive hover:text-destructive/80 text-sm px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Deductions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Deductions</span>
                <button
                  type="button"
                  onClick={() => setDeductions((d) => [...d, { name: "", amount: 0 }])}
                  className="text-xs text-primary hover:underline"
                >
                  + Add
                </button>
              </div>
              {deductions.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      setDeductions((d) => d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder="Name"
                    className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) =>
                      setDeductions((d) =>
                        d.map((x, j) => (j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))
                      )
                    }
                    placeholder="Amount"
                    className="flex h-8 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setDeductions((d) => d.filter((_, j) => j !== i))}
                    className="text-destructive hover:text-destructive/80 text-sm px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {state?.success === false && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Employee</th>
              <th className="px-4 py-3 text-left font-medium">Effective From</th>
              <th className="px-4 py-3 text-right font-medium">Basic</th>
              <th className="px-4 py-3 text-right font-medium">Allowances</th>
              <th className="px-4 py-3 text-right font-medium">Deductions</th>
              <th className="px-4 py-3 text-right font-medium">Gross</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {structures.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No salary structures defined.
                </td>
              </tr>
            )}
            {structures.map((s) => {
              const emp = empMap.get(s.employeeId);
              const allowancesArr = (s.allowances as AllowanceItem[]) ?? [];
              const deductionsArr = (s.deductions as AllowanceItem[]) ?? [];
              const totalAllowances = allowancesArr.reduce((sum, a) => sum + a.amount, 0);
              const totalDeductions = deductionsArr.reduce((sum, d) => sum + d.amount, 0);
              return (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {emp ? `${emp.empCode} — ${emp.fullName}` : s.employeeId}
                  </td>
                  <td className="px-4 py-3">{s.effectiveFrom}</td>
                  <td className="px-4 py-3 text-right">{parseFloat(s.basic ?? "0").toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right">{totalAllowances.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right">{totalDeductions.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right font-medium">{parseFloat(s.gross ?? "0").toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(s)}
                        className="text-xs text-primary hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
