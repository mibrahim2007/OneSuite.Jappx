"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

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
import {
  createFiscalYearAction,
  setPeriodStatusAction,
} from "@/server/actions/fiscal-periods";
import type { FiscalPeriod } from "@/lib/db/schema";
import type { PeriodStatus } from "@/lib/validations/fiscal-periods";

function computeYearLabel(startYear: number, fiscalStartMonth: number): string {
  if (fiscalStartMonth === 1) return `FY ${startYear}`;
  const shortNext = String((startYear + 1) % 100).padStart(2, "0");
  return `FY ${startYear}-${shortNext}`;
}

function getStatusVariant(
  status: string
): "outline" | "secondary" | "destructive" | "default" {
  if (status === "open") return "outline";
  if (status === "closed") return "secondary";
  if (status === "locked") return "destructive";
  return "default";
}

type FiscalPeriodsViewProps = {
  periods: FiscalPeriod[];
  fiscalStartMonth: number;
  canCreate: boolean;
  canClose: boolean;
  canLock: boolean;
};

export function FiscalPeriodsView({
  periods,
  fiscalStartMonth,
  canCreate,
  canClose,
  canLock,
}: FiscalPeriodsViewProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startYear, setStartYear] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isCreating, startCreateTransition] = useTransition();
  const [, startStatusTransition] = useTransition();

  const groupedPeriods = useMemo(() => {
    const map = new Map<string, FiscalPeriod[]>();
    for (const period of periods) {
      const existing = map.get(period.yearLabel) ?? [];
      existing.push(period);
      map.set(period.yearLabel, existing);
    }
    return map;
  }, [periods]);

  const yearInt = parseInt(startYear, 10);
  const previewLabel =
    startYear.length === 4 && !isNaN(yearInt)
      ? computeYearLabel(yearInt, fiscalStartMonth)
      : null;

  function openCreateDialog() {
    setStartYear("");
    setDialogOpen(true);
  }

  function handleCreate() {
    const year = parseInt(startYear, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      toast.error("Enter a valid year between 2000 and 2100.");
      return;
    }
    startCreateTransition(async () => {
      try {
        const result = await createFiscalYearAction(year);
        if (result.success) {
          setDialogOpen(false);
          router.refresh();
          toast.success("Fiscal year created.");
        } else {
          toast.error(result.error ?? "Failed to create fiscal year.");
        }
      } catch {
        toast.error("Failed to create fiscal year.");
      }
    });
  }

  function handleSetStatus(
    periodId: string,
    newStatus: "open" | "closed" | "locked"
  ) {
    setPendingIds((prev) => new Set(prev).add(periodId));
    startStatusTransition(async () => {
      try {
        const result = await setPeriodStatusAction(periodId, newStatus);
        if (result.success) {
          router.refresh();
          toast.success(
            newStatus === "closed"
              ? "Period closed."
              : newStatus === "open"
                ? "Period reopened."
                : "Period locked."
          );
        } else {
          toast.error(result.error ?? "Failed to update period status.");
        }
      } catch {
        toast.error("Failed to update period status.");
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(periodId);
          return next;
        });
      }
    });
  }

  const showActionsColumn = canClose || canLock;

  return (
    <div className="space-y-6">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreateDialog}>
            Create Fiscal Year
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Fiscal Year</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="start-year">Start Year</Label>
              <Input
                id="start-year"
                type="number"
                min={2000}
                max={2100}
                placeholder="e.g. 2026"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
              {previewLabel && (
                <p className="text-xs text-muted-foreground">
                  Will create 12 periods for{" "}
                  <span className="font-medium">{previewLabel}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {periods.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No fiscal periods yet"
          description="Create your first fiscal year to start managing accounting periods."
          action={
            canCreate ? (
              <Button size="sm" onClick={openCreateDialog}>
                Create First Fiscal Year
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {Array.from(groupedPeriods.entries()).map(([yearLabel, yearPeriods]) => (
            <div key={yearLabel} className="space-y-2">
              <h2 className="text-base font-semibold">{yearLabel}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    {showActionsColumn && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearPeriods.map((period) => (
                    <TableRow key={period.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {period.periodNum}
                      </TableCell>
                      <TableCell className="font-medium">{period.name}</TableCell>
                      <TableCell className="text-sm">{period.startDate}</TableCell>
                      <TableCell className="text-sm">{period.endDate}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(period.status)}>
                          {(period.status as PeriodStatus).charAt(0).toUpperCase() +
                            period.status.slice(1)}
                        </Badge>
                      </TableCell>
                      {showActionsColumn && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {period.status === "open" && canClose && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pendingIds.has(period.id)}
                                onClick={() =>
                                  handleSetStatus(period.id, "closed")
                                }
                              >
                                {pendingIds.has(period.id) ? "…" : "Close"}
                              </Button>
                            )}
                            {period.status === "closed" && canClose && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pendingIds.has(period.id)}
                                onClick={() =>
                                  handleSetStatus(period.id, "open")
                                }
                              >
                                {pendingIds.has(period.id) ? "…" : "Reopen"}
                              </Button>
                            )}
                            {period.status === "closed" && canLock && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pendingIds.has(period.id)}
                                onClick={() =>
                                  handleSetStatus(period.id, "locked")
                                }
                              >
                                {pendingIds.has(period.id) ? "…" : "Lock"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
