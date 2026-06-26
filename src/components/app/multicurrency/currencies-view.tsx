"use client";

import { useActionState, useTransition, useState } from "react";
import { toast } from "sonner";

import type { Currency, ExchangeRate } from "@/lib/db/schema";
import { SELECT_CLASS } from "@/lib/ui-constants";
import {
  createCurrencyAction,
  addExchangeRateAction,
  toggleCurrencyActiveAction,
} from "@/server/actions/multicurrency/currencies";

interface Props {
  currencies: Currency[];
  exchangeRates: ExchangeRate[];
  canManage: boolean;
}

export function CurrenciesView({ currencies, exchangeRates, canManage }: Props) {
  const [tab, setTab] = useState<"currencies" | "rates">("currencies");
  const [currDialogOpen, setCurrDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [currDialogKey, setCurrDialogKey] = useState(0);
  const [rateDialogKey, setRateDialogKey] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const [currState, currAction, currPending] = useActionState(createCurrencyAction, null);
  const [rateState, rateAction, ratePending] = useActionState(addExchangeRateAction, null);

  const today = new Date().toISOString().split("T")[0];

  function handleToggle(id: string, isActive: boolean) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        const res = await toggleCurrencyActiveAction(id, isActive);
        if (!res.success) toast.error(res.error ?? "Failed to update.");
        else toast.success(isActive ? "Currency activated." : "Currency deactivated.");
      } catch {
        toast.error("An error occurred.");
      } finally {
        setPendingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Currencies & Exchange Rates</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(["currencies", "rates"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "currencies" ? "Currencies" : "Exchange Rates"}
          </button>
        ))}
      </div>

      {tab === "currencies" && (
        <div className="space-y-4">
          {canManage && (
            <button
              onClick={() => { setCurrDialogKey((k) => k + 1); setCurrDialogOpen(true); }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              + New Currency
            </button>
          )}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                {["Code", "Name", "Symbol", "Base", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2">{c.symbol}</td>
                  <td className="px-4 py-2">{c.isBase ? <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Base</span> : null}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {canManage && !c.isBase && (
                      <button
                        disabled={pendingIds.has(c.id)}
                        onClick={() => handleToggle(c.id, !c.isActive)}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                      >
                        {pendingIds.has(c.id) ? "…" : c.isActive ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {currencies.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No currencies defined.</td></tr>
              )}
            </tbody>
          </table>

          {/* New Currency Dialog */}
          {currDialogOpen && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
                <h2 className="text-lg font-semibold">New Currency</h2>
                <form key={currDialogKey} action={currAction} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Code (ISO 4217) *</label>
                    <input name="code" maxLength={3} placeholder="USD" className="w-full border rounded px-3 py-2 text-sm uppercase" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input name="name" placeholder="US Dollar" className="w-full border rounded px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Symbol</label>
                    <input name="symbol" placeholder="$" className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="isBase" value="true" />
                    Set as base currency
                  </label>
                  {currState && !currState.success && (
                    <p className="text-sm text-red-600">{currState.error}</p>
                  )}
                  <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={() => setCurrDialogOpen(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={currPending} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {currPending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "rates" && (
        <div className="space-y-4">
          {canManage && (
            <button
              onClick={() => { setRateDialogKey((k) => k + 1); setRateDialogOpen(true); }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              + Add Rate
            </button>
          )}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                {["Date", "From", "To", "Rate", "Source"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exchangeRates.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.effectiveDate}</td>
                  <td className="px-4 py-2 font-semibold">{r.fromCurrency}</td>
                  <td className="px-4 py-2 font-semibold">{r.toCurrency}</td>
                  <td className="px-4 py-2 text-right font-mono">{parseFloat(r.rate).toFixed(6)}</td>
                  <td className="px-4 py-2 text-gray-500">{r.source}</td>
                </tr>
              ))}
              {exchangeRates.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No exchange rates defined.</td></tr>
              )}
            </tbody>
          </table>

          {/* Add Rate Dialog */}
          {rateDialogOpen && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
                <h2 className="text-lg font-semibold">Add Exchange Rate</h2>
                <form key={rateDialogKey} action={rateAction} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">From *</label>
                      <select name="fromCurrency" className={SELECT_CLASS} required>
                        {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">To *</label>
                      <select name="toCurrency" className={SELECT_CLASS} required>
                        {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rate *</label>
                    <input name="rate" type="number" step="0.000001" min="0.000001" placeholder="1.000000" className="w-full border rounded px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Effective Date *</label>
                    <input name="effectiveDate" type="date" defaultValue={today} className="w-full border rounded px-3 py-2 text-sm" required />
                  </div>
                  {rateState && !rateState.success && (
                    <p className="text-sm text-red-600">{rateState.error}</p>
                  )}
                  <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={() => setRateDialogOpen(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={ratePending} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {ratePending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
