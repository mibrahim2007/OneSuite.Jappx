"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { voidJournalAction } from "@/server/actions/journal-entries";
import type { Journal } from "@/lib/db/schema";

type Row = { journal: Journal; periodName: string | null };

type JournalEntriesListProps = {
  rows: Row[];
  canPost: boolean;
  canVoid: boolean;
};

type StatusInfo = {
  label: string;
  variant: "outline" | "secondary" | "destructive" | "default";
};

function getStatusInfo(journal: Journal): StatusInfo {
  // Reversal entries are identified by the "VOID: " prefix set at creation time
  if (journal.reference?.startsWith("VOID: ")) {
    return { label: "Reversal", variant: "secondary" };
  }
  // isPosted=false means the journal was voided; reference field is not used for void state
  if (!journal.isPosted) {
    return { label: "Voided", variant: "secondary" };
  }
  return { label: "Posted", variant: "outline" };
}

function canVoidJournal(journal: Journal): boolean {
  return journal.isPosted && !journal.reference?.startsWith("VOID: ");
}

export function JournalEntriesList({
  rows,
  canPost,
  canVoid,
}: JournalEntriesListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleVoid(journalId: string, entryNo: string) {
    if (!confirm(`Void journal ${entryNo}? This will create a reversing entry.`)) return;
    setPendingId(journalId);
    startTransition(async () => {
      const result = await voidJournalAction(journalId);
      setPendingId(null);
      if (result.success) {
        toast.success("Journal voided.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to void journal.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/app/accounts/general-ledger")}
        >
          General Ledger
        </Button>
        {canPost && (
          <Button size="sm" onClick={() => router.push("/app/accounts/journal-entries/new")}>
            New Journal Entry
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No journal entries yet"
          description="Post your first manual journal entry to get started."
          action={
            canPost ? (
              <Button
                size="sm"
                onClick={() => router.push("/app/accounts/journal-entries/new")}
              >
                New Journal Entry
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry No.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead>Status</TableHead>
              {canVoid && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ journal, periodName }) => {
              const status = getStatusInfo(journal);
              const voidable = canVoidJournal(journal);
              return (
                <TableRow key={journal.id}>
                  <TableCell className="font-mono text-sm font-medium">
                    {journal.entryNo}
                  </TableCell>
                  <TableCell className="text-sm">{journal.entryDate}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {periodName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {journal.reference ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                    {journal.memo ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  {canVoid && (
                    <TableCell className="text-right">
                      {voidable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingId === journal.id}
                          onClick={() => handleVoid(journal.id, journal.entryNo)}
                        >
                          {pendingId === journal.id ? "…" : "Void"}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
