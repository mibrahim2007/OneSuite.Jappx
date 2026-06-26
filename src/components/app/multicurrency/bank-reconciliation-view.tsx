"use client";

import { useActionState, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";

import type { BankStatement, BankStatementLine } from "@/lib/db/schema";
import { SELECT_CLASS } from "@/lib/ui-constants";
import {
  createBankStatementAction,
  addStatementLineAction,
  matchStatementLineAction,
  finaliseReconciliationAction,
} from "@/server/actions/multicurrency/bank-reconciliation";

interface GlLine {
  id: string;
  date: string;
  description: string | null;
  debit: string;
  credit: string;
  entryNo: string;
}

interface BankAccount { id: string; name: string; code: string; }

interface Props {
  bankAccounts: BankAccount[];
  statements: BankStatement[];
  selectedStatement: BankStatement | null;
  statementLines: BankStatementLine[];
  unmatchedGlLines: GlLine[];
  canPost: boolean;
}

export function BankReconciliationView({
  bankAccounts,
  statements,
  selectedStatement,
  statementLines,
  unmatchedGlLines,
  canPost,
}: Props) {
  const router = useRouter();
  const [stmtDialogOpen, setStmtDialogOpen] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [stmtKey, setStmtKey] = useState(0);
  const [lineKey, setLineKey] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  const [stmtState, stmtAction, stmtPending] = useActionState(createBankStatementAction, null);
  const [lineState, lineAction, linePending] = useActionState(addStatementLineAction, null);

  function handleMatch(lineId: string, journalLineId: string | null) {
    setPendingIds((p) => new Set(p).add(lineId));
    startTransition(async () => {
      try {
        const res = await matchStatementLineAction(lineId, journalLineId);
        if (!res.success) toast.error(res.error ?? "Match failed.");
        else { toast.success(journalLineId ? "Matched." : "Unmatched."); router.refresh(); }
      } catch { toast.error("Error."); }
      finally { setPendingIds((p) => { const n = new Set(p); n.delete(lineId); return n; }); }
    });
  }

  function handleFinalise() {
    if (!selectedStatement) return;
    setPendingIds((p) => new Set(p).add(selectedStatement.id));
    startTransition(async () => {
      try {
        const res = await finaliseReconciliationAction(selectedStatement.id);
        if (!res.success) toast.error(res.error ?? "Failed.");
        else { toast.success("Reconciliation finalised."); router.refresh(); }
      } catch { toast.error("Error."); }
      finally { setPendingIds((p) => { const n = new Set(p); n.delete(selectedStatement.id); return n; }); }
    });
  }

  const matchedCount = statementLines.filter((l) => l.matchedJournalLineId).length;
  const unmatchedCount = statementLines.length - matchedCount;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bank Reconciliation</h1>
        <button
          onClick={() => { setStmtKey((k) => k + 1); setStmtDialogOpen(true); }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          + New Statement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statement list */}
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b font-medium text-sm">Statements</div>
          <div className="divide-y">
            {statements.map((s) => (
              <button
                key={s.id}
                onClick={() => { const p = new URLSearchParams({ statementId: s.id }); router.push((`/app/accounts/bank-reconciliation?${p}`) as Route); }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedStatement?.id === s.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
              >
                <div className="text-sm font-medium">{s.statementDate}</div>
                <div className="text-xs text-gray-500">Closing: {parseFloat(s.closingBalance).toFixed(2)}</div>
                {s.isReconciled && <span className="text-xs text-green-600 font-medium">✓ Reconciled</span>}
              </button>
            ))}
            {statements.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No statements yet.</p>
            )}
          </div>
        </div>

        {/* Statement detail */}
        <div className="lg:col-span-2 space-y-4">
          {selectedStatement ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Statement: {selectedStatement.statementDate}</h2>
                  <p className="text-sm text-gray-500">
                    Opening: {parseFloat(selectedStatement.openingBalance).toFixed(2)} |
                    Closing: {parseFloat(selectedStatement.closingBalance).toFixed(2)} |
                    {matchedCount} matched, {unmatchedCount} unmatched
                  </p>
                </div>
                <div className="flex gap-2">
                  {!selectedStatement.isReconciled && (
                    <>
                      <button
                        onClick={() => { setLineKey((k) => k + 1); setLineDialogOpen(true); }}
                        className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
                      >
                        + Add Line
                      </button>
                      {canPost && unmatchedCount === 0 && statementLines.length > 0 && (
                        <button
                          onClick={handleFinalise}
                          disabled={pendingIds.has(selectedStatement.id)}
                          className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                          {pendingIds.has(selectedStatement.id) ? "…" : "Finalise Reconciliation"}
                        </button>
                      )}
                    </>
                  )}
                  {selectedStatement.isReconciled && (
                    <span className="px-3 py-1.5 text-sm text-green-700 bg-green-100 rounded-md">✓ Reconciled</span>
                  )}
                </div>
              </div>

              <table className="w-full text-sm border-collapse border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {["Date", "Description", "Debit", "Credit", "Ref", "Status", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statementLines.map((line) => (
                    <tr key={line.id} className={`border-b hover:bg-gray-50 ${line.matchedJournalLineId ? "bg-green-50" : ""}`}>
                      <td className="px-3 py-2 font-mono text-xs">{line.lineDate}</td>
                      <td className="px-3 py-2">{line.description ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{parseFloat(line.debit) > 0 ? parseFloat(line.debit).toFixed(2) : ""}</td>
                      <td className="px-3 py-2 text-right">{parseFloat(line.credit) > 0 ? parseFloat(line.credit).toFixed(2) : ""}</td>
                      <td className="px-3 py-2 text-gray-500">{line.reference ?? ""}</td>
                      <td className="px-3 py-2">
                        {line.matchedJournalLineId
                          ? <span className="text-xs text-green-600">✓ Matched</span>
                          : <span className="text-xs text-amber-600">Unmatched</span>}
                      </td>
                      <td className="px-3 py-2">
                        {!selectedStatement.isReconciled && (
                          line.matchedJournalLineId ? (
                            <button
                              disabled={pendingIds.has(line.id)}
                              onClick={() => handleMatch(line.id, null)}
                              className="text-xs text-red-500 hover:underline disabled:opacity-50"
                            >
                              {pendingIds.has(line.id) ? "…" : "Unmatch"}
                            </button>
                          ) : (
                            <select
                              className="text-xs border rounded px-1 py-0.5"
                              defaultValue=""
                              onChange={(e) => { if (e.target.value) handleMatch(line.id, e.target.value); }}
                              disabled={pendingIds.has(line.id)}
                            >
                              <option value="">Match GL line…</option>
                              {unmatchedGlLines.map((gl) => (
                                <option key={gl.id} value={gl.id}>
                                  {gl.date} | {gl.entryNo} | DR:{parseFloat(gl.debit).toFixed(2)} CR:{parseFloat(gl.credit).toFixed(2)}
                                </option>
                              ))}
                            </select>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                  {statementLines.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No lines yet. Add statement lines.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <div className="border rounded-lg p-12 text-center text-gray-400">
              Select a statement from the left to start reconciling.
            </div>
          )}
        </div>
      </div>

      {/* New Statement Dialog */}
      {stmtDialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">New Bank Statement</h2>
            <form key={stmtKey} action={stmtAction} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Bank Account *</label>
                <select name="accountId" className={SELECT_CLASS} required>
                  <option value="">Select account…</option>
                  {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Statement Date *</label>
                <input name="statementDate" type="date" defaultValue={today} className="w-full border rounded px-3 py-2 text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Opening Balance *</label>
                  <input name="openingBalance" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Closing Balance *</label>
                  <input name="closingBalance" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-3 py-2 text-sm" required />
                </div>
              </div>
              {stmtState && !stmtState.success && <p className="text-sm text-red-600">{stmtState.error}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setStmtDialogOpen(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={stmtPending} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {stmtPending ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Line Dialog */}
      {lineDialogOpen && selectedStatement && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Add Statement Line</h2>
            <form key={lineKey} action={lineAction} className="space-y-3">
              <input type="hidden" name="statementId" value={selectedStatement.id} />
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input name="lineDate" type="date" defaultValue={today} className="w-full border rounded px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input name="description" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Debit</label>
                  <input name="debit" type="number" step="0.01" defaultValue="0" min="0" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Credit</label>
                  <input name="credit" type="number" step="0.01" defaultValue="0" min="0" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference</label>
                <input name="reference" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              {lineState && !lineState.success && <p className="text-sm text-red-600">{lineState.error}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setLineDialogOpen(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={linePending} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {linePending ? "Adding…" : "Add Line"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
