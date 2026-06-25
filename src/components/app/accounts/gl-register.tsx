"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { getJournalDetailAction } from "@/server/actions/journal-entries";
import type { Journal, JournalLine } from "@/lib/db/schema";

type GlRow = {
  lineId: string;
  journalId: string;
  entryNo: string;
  entryDate: string;
  journalMemo: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  debit: string;
  credit: string;
  periodName: string | null;
  runningBalance: number;
};

type PeriodOption = { id: string; name: string; startDate: string };
type AccountOption = { id: string; code: string; name: string; type: string };

type GlFilters = {
  accountId?: string;
  periodId?: string;
  dateFrom?: string;
  dateTo?: string;
};

type JournalDetail = {
  journal: Journal;
  lines: Array<JournalLine & { accountCode: string; accountName: string }>;
};

type GlRegisterProps = {
  rows: GlRow[];
  allPeriods: PeriodOption[];
  allAccounts: AccountOption[];
  filters: GlFilters;
  openingBalance: number | null;
  closingBalance: number | null;
  truncated: boolean;
};

function exportToCsv(rows: GlRow[]) {
  const headers = [
    "Date", "Journal No", "Account Code", "Account Name",
    "Description", "Debit", "Credit", "Running Balance",
  ];
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [
      r.entryDate, r.entryNo, r.accountCode, r.accountName,
      r.description, r.debit, r.credit, r.runningBalance.toFixed(2),
    ]
      .map(escape)
      .join(",")
  );
  const csv = [headers.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function GlRegister({
  rows,
  allPeriods,
  allAccounts,
  filters,
  openingBalance,
  closingBalance,
  truncated,
}: GlRegisterProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const requestIdRef = useRef(0);

  // Local filter form state (reflects current filters from URL)
  const [localAccountId, setLocalAccountId] = useState(filters.accountId ?? "");
  const [localPeriodId, setLocalPeriodId] = useState(filters.periodId ?? "");
  const [localDateFrom, setLocalDateFrom] = useState(filters.dateFrom ?? "");
  const [localDateTo, setLocalDateTo] = useState(filters.dateTo ?? "");

  // Journal detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<JournalDetail | null>(null);

  function applyFilters() {
    const params = new URLSearchParams();
    if (localAccountId) params.set("accountId", localAccountId);
    if (localPeriodId) params.set("periodId", localPeriodId);
    if (localDateFrom) params.set("dateFrom", localDateFrom);
    if (localDateTo) params.set("dateTo", localDateTo);
    const qs = params.toString();
    router.push(`/app/accounts/general-ledger${qs ? `?${qs}` : ""}` as Route);
  }

  function clearFilters() {
    setLocalAccountId("");
    setLocalPeriodId("");
    setLocalDateFrom("");
    setLocalDateTo("");
    router.push("/app/accounts/general-ledger");
  }

  function openDetail(journalId: string) {
    const requestId = ++requestIdRef.current;
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    startTransition(async () => {
      try {
        const result = await getJournalDetailAction(journalId);
        if (requestId !== requestIdRef.current) return; // stale — a newer request superseded this one
        setDetailLoading(false);
        if (result.success && result.journal && result.lines) {
          setDetail({ journal: result.journal, lines: result.lines });
        } else {
          toast.error(result.error ?? "Failed to load journal detail.");
          setDetailOpen(false);
        }
      } catch {
        if (requestId !== requestIdRef.current) return;
        setDetailLoading(false);
        setDetailOpen(false);
        toast.error("Failed to load journal detail.");
      }
    });
  }

  const showBalances = openingBalance !== null && closingBalance !== null;

  return (
    <div className="space-y-4">
      {/* Filter form */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Account</label>
            <select
              className={SELECT_CLASS}
              value={localAccountId}
              onChange={(e) => setLocalAccountId(e.target.value)}
            >
              <option value="">All accounts</option>
              {allAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Fiscal Period</label>
            <select
              className={SELECT_CLASS}
              value={localPeriodId}
              onChange={(e) => setLocalPeriodId(e.target.value)}
            >
              <option value="">All periods</option>
              {allPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From Date</label>
            <input
              type="date"
              className={SELECT_CLASS}
              value={localDateFrom}
              onChange={(e) => setLocalDateFrom(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To Date</label>
            <input
              type="date"
              className={SELECT_CLASS}
              value={localDateTo}
              onChange={(e) => setLocalDateTo(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={applyFilters}>
            Apply Filters
          </Button>
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length === 0}
            onClick={() => exportToCsv(rows)}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Opening / Closing balance summary */}
      {showBalances && (
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Opening Balance</span>
              <p className={`font-mono font-medium ${openingBalance! < 0 ? "text-destructive" : ""}`}>
                {openingBalance!.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Period Net</span>
              <p className="font-mono font-medium">
                {(closingBalance! - openingBalance!).toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Closing Balance</span>
              <p className={`font-mono font-medium ${closingBalance! < 0 ? "text-destructive" : ""}`}>
                {closingBalance!.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Truncation warning */}
      {truncated && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          Showing first 500 lines — apply filters to narrow results.
        </div>
      )}

      {/* GL table or empty state */}
      {rows.length === 0 ? (
        <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
          No posted journal lines found for the selected filters.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Journal No</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.lineId}>
                <TableCell className="text-sm">{row.entryDate}</TableCell>
                <TableCell>
                  <button
                    className="font-mono text-sm font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => openDetail(row.journalId)}
                  >
                    {row.entryNo}
                  </button>
                </TableCell>
                <TableCell className="text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{row.accountCode}</span>{" "}
                  {row.accountName}
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                  {row.description ?? row.journalMemo ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {parseFloat(row.debit) > 0 ? parseFloat(row.debit).toFixed(2) : ""}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {parseFloat(row.credit) > 0 ? parseFloat(row.credit).toFixed(2) : ""}
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-sm ${
                    row.runningBalance < 0 ? "text-destructive" : ""
                  }`}
                >
                  {row.runningBalance.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Journal detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detailLoading ? "Loading…" : detail ? `Journal ${detail.journal.entryNo}` : "Journal Detail"}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          )}

          {!detailLoading && detail && (
            <div className="space-y-4">
              {/* Journal header info */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  <span className="font-medium">{detail.journal.entryDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Source:</span>{" "}
                  <span className="capitalize">{detail.journal.source}</span>
                </div>
                {detail.journal.reference && (
                  <div>
                    <span className="text-muted-foreground">Reference:</span>{" "}
                    {detail.journal.reference}
                  </div>
                )}
                {detail.journal.memo && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Memo:</span>{" "}
                    {detail.journal.memo}
                  </div>
                )}
              </div>

              {/* Lines table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{line.accountCode}</span>{" "}
                        {line.accountName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {line.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {parseFloat(line.debit) > 0 ? parseFloat(line.debit).toFixed(2) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {parseFloat(line.credit) > 0 ? parseFloat(line.credit).toFixed(2) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="flex justify-end gap-8 border-t pt-2 text-sm">
                <span>
                  <span className="text-muted-foreground">Total Debit:</span>{" "}
                  <span className="font-mono font-medium">
                    {detail.lines.reduce((s, l) => s + parseFloat(l.debit), 0).toFixed(2)}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Total Credit:</span>{" "}
                  <span className="font-mono font-medium">
                    {detail.lines.reduce((s, l) => s + parseFloat(l.credit), 0).toFixed(2)}
                  </span>
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
