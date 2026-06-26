"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Route } from "next";

type TBRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  groupName: string | null;
  groupType: string | null;
  totalDebit: string;
  totalCredit: string;
};

type PLRow = {
  groupType: string | null;
  groupName: string | null;
  accountCode: string;
  accountName: string;
  net: string;
};

type BSRow = PLRow;

type ARRow = {
  invoiceNo: string;
  customerName: string | null;
  dueDate: string;
  total: string;
};

type APRow = {
  billNo: string;
  vendorName: string | null;
  dueDate: string;
  total: string;
};

type Period = { id: string; name: string };

type Props = {
  activeTab: string;
  trialBalance: TBRow[];
  plRows: PLRow[];
  bsRows: BSRow[];
  arRows: ARRow[];
  apRows: APRow[];
  periods: Period[];
  fromDate: string | null;
  toDate: string | null;
  asOfDate: string;
};

const TABS = [
  { id: "trial-balance", label: "Trial Balance" },
  { id: "pl", label: "P&L" },
  { id: "balance-sheet", label: "Balance Sheet" },
  { id: "ar-ageing", label: "AR Ageing" },
  { id: "ap-ageing", label: "AP Ageing" },
] as const;

function ageBucket(dueDate: string): string {
  const due = new Date(dueDate);
  const today = new Date();
  const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  if (days <= 0) return "Current";
  if (days <= 30) return "0–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  return "90+ days";
}

const BUCKET_ORDER = ["Current", "0–30 days", "31–60 days", "61–90 days", "90+ days"];

function fmt(v: string | number) {
  return parseFloat(String(v)).toLocaleString("en-PK", { minimumFractionDigits: 2 });
}

export function ReportsView({ activeTab, trialBalance, plRows, bsRows, arRows, apRows, periods, fromDate, toDate, asOfDate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setTab(tab: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    router.push(`${pathname}?${p.toString()}` as Route);
  }

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    router.push(`${pathname}?${p.toString()}` as Route);
  }

  // ── Trial Balance ─────────────────────────────────────────────────────────
  const totalDr = trialBalance.reduce((s, r) => s + parseFloat(r.totalDebit), 0);
  const totalCr = trialBalance.reduce((s, r) => s + parseFloat(r.totalCredit), 0);

  // ── P&L ──────────────────────────────────────────────────────────────────
  const incomeTypes = new Set(["income", "revenue"]);
  const revenue = plRows.filter((r) => incomeTypes.has(r.groupType ?? ""));
  const expenses = plRows.filter((r) => !incomeTypes.has(r.groupType ?? ""));
  const totalRevenue = revenue.reduce((s, r) => s + Math.abs(parseFloat(r.net)), 0);
  const totalExpenses = expenses.reduce((s, r) => s + Math.abs(parseFloat(r.net)), 0);

  // ── Balance Sheet ─────────────────────────────────────────────────────────
  const assets = bsRows.filter((r) => r.groupType === "asset");
  const liabilities = bsRows.filter((r) => r.groupType === "liability");
  const equity = bsRows.filter((r) => r.groupType === "equity");

  // ── Ageing helpers ────────────────────────────────────────────────────────
  function buildAgeing<T extends { dueDate: string; total: string }>(rows: T[]) {
    const buckets = new Map<string, number>();
    for (const row of rows) {
      const b = ageBucket(row.dueDate);
      buckets.set(b, (buckets.get(b) ?? 0) + parseFloat(row.total));
    }
    return buckets;
  }

  const arBuckets = buildAgeing(arRows);
  const apBuckets = buildAgeing(apRows);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Financial Reports</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TRIAL BALANCE ── */}
      {activeTab === "trial-balance" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">All posted journal entries — cumulative.</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Code</th>
                  <th className="px-4 py-3 text-left font-medium">Account</th>
                  <th className="px-4 py-3 text-left font-medium">Group</th>
                  <th className="px-4 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {trialBalance.map((r) => (
                  <tr key={r.accountId} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{r.accountCode}</td>
                    <td className="px-4 py-2">{r.accountName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.groupName ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.totalDebit)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.totalCredit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-3">Total</td>
                  <td className={`px-4 py-3 text-right font-mono ${Math.abs(totalDr - totalCr) > 0.01 ? "text-destructive" : ""}`}>{fmt(totalDr)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(totalCr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {Math.abs(totalDr - totalCr) > 0.01 && (
            <p className="text-sm text-destructive">⚠ Trial Balance is out of balance by {fmt(Math.abs(totalDr - totalCr))}</p>
          )}
        </div>
      )}

      {/* ── P&L ── */}
      {activeTab === "pl" && (
        <div className="space-y-3">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-xs font-medium mb-1">From</label>
              <input type="date" defaultValue={fromDate ?? ""} onChange={(e) => setParam("from", e.target.value)}
                className="h-8 rounded border border-input px-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">To</label>
              <input type="date" defaultValue={toDate ?? ""} onChange={(e) => setParam("to", e.target.value)}
                className="h-8 rounded border border-input px-2 text-sm" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Account</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {revenue.length > 0 && (
                  <tr className="bg-muted/20"><td colSpan={2} className="px-4 py-2 font-semibold text-xs uppercase tracking-wide">Revenue</td></tr>
                )}
                {revenue.map((r) => (
                  <tr key={r.accountCode} className="hover:bg-muted/30">
                    <td className="px-4 py-2">{r.accountCode} — {r.accountName}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(Math.abs(parseFloat(r.net)))}</td>
                  </tr>
                ))}
                {revenue.length > 0 && (
                  <tr className="font-medium bg-muted/10">
                    <td className="px-4 py-2">Total Revenue</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(totalRevenue)}</td>
                  </tr>
                )}
                {expenses.length > 0 && (
                  <tr className="bg-muted/20"><td colSpan={2} className="px-4 py-2 font-semibold text-xs uppercase tracking-wide">Expenses</td></tr>
                )}
                {expenses.map((r) => (
                  <tr key={r.accountCode} className="hover:bg-muted/30">
                    <td className="px-4 py-2">{r.accountCode} — {r.accountName}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(Math.abs(parseFloat(r.net)))}</td>
                  </tr>
                ))}
                {expenses.length > 0 && (
                  <tr className="font-medium bg-muted/10">
                    <td className="px-4 py-2">Total Expenses</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(totalExpenses)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-semibold">
                <tr>
                  <td className="px-4 py-3">Net Income / (Loss)</td>
                  <td className={`px-4 py-3 text-right font-mono ${totalRevenue - totalExpenses < 0 ? "text-destructive" : "text-green-700"}`}>
                    {fmt(totalRevenue - totalExpenses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── BALANCE SHEET ── */}
      {activeTab === "balance-sheet" && (
        <div className="space-y-3">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-xs font-medium mb-1">As of Date</label>
              <input type="date" defaultValue={asOfDate} onChange={(e) => setParam("date", e.target.value)}
                className="h-8 rounded border border-input px-2 text-sm" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Account</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  { label: "Assets", rows: assets, sign: 1 },
                  { label: "Liabilities", rows: liabilities, sign: -1 },
                  { label: "Equity", rows: equity, sign: -1 },
                ].map(({ label, rows: sectionRows, sign }) => (
                  <>
                    <tr key={label} className="bg-muted/20">
                      <td colSpan={2} className="px-4 py-2 font-semibold text-xs uppercase tracking-wide">{label}</td>
                    </tr>
                    {sectionRows.map((r) => (
                      <tr key={r.accountCode} className="hover:bg-muted/30">
                        <td className="px-4 py-2">{r.accountCode} — {r.accountName}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(parseFloat(r.net) * sign)}</td>
                      </tr>
                    ))}
                    <tr className="font-medium bg-muted/10">
                      <td className="px-4 py-2">Total {label}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {fmt(sectionRows.reduce((s, r) => s + parseFloat(r.net) * sign, 0))}
                      </td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AR AGEING ── */}
      {activeTab === "ar-ageing" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Posted invoices not yet paid, grouped by days overdue.</p>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {BUCKET_ORDER.map((b) => (
              <div key={b} className="rounded-md border p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground">{b}</p>
                <p className="mt-1 text-lg font-semibold">{fmt(arBuckets.get(b) ?? 0)}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Due Date</th>
                  <th className="px-4 py-3 text-left font-medium">Bucket</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {arRows.map((r) => (
                  <tr key={r.invoiceNo} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{r.invoiceNo}</td>
                    <td className="px-4 py-2">{r.customerName ?? "—"}</td>
                    <td className="px-4 py-2">{r.dueDate}</td>
                    <td className="px-4 py-2 text-muted-foreground">{ageBucket(r.dueDate)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-semibold">
                <tr>
                  <td colSpan={4} className="px-4 py-3">Total AR</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {fmt(arRows.reduce((s, r) => s + parseFloat(r.total), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── AP AGEING ── */}
      {activeTab === "ap-ageing" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Posted bills not yet paid, grouped by days overdue.</p>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {BUCKET_ORDER.map((b) => (
              <div key={b} className="rounded-md border p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground">{b}</p>
                <p className="mt-1 text-lg font-semibold">{fmt(apBuckets.get(b) ?? 0)}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Bill #</th>
                  <th className="px-4 py-3 text-left font-medium">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium">Due Date</th>
                  <th className="px-4 py-3 text-left font-medium">Bucket</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {apRows.map((r) => (
                  <tr key={r.billNo} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{r.billNo}</td>
                    <td className="px-4 py-2">{r.vendorName ?? "—"}</td>
                    <td className="px-4 py-2">{r.dueDate}</td>
                    <td className="px-4 py-2 text-muted-foreground">{ageBucket(r.dueDate)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-semibold">
                <tr>
                  <td colSpan={4} className="px-4 py-3">Total AP</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {fmt(apRows.reduce((s, r) => s + parseFloat(r.total), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
