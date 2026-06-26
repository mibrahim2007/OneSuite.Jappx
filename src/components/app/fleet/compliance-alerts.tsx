"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/lib/ui-constants";
import {
  createVehicleDocumentAction,
  deleteVehicleDocumentAction,
} from "@/server/actions/fleet/vehicle-documents";

type DocumentRow = {
  id: string;
  vehicleId: string;
  regNumber: string;
  docType: string;
  docNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  alertDays: number | null;
};

type VehicleOption = { id: string; regNumber: string };
type State = { success: true } | { success: false; error: string } | null;

const DOC_TYPES = [
  "Registration",
  "Insurance",
  "Mulkiya",
  "Road Test",
  "Emissions",
  "Driver License",
  "Permit",
  "Other",
];

function alertStatus(doc: DocumentRow, today: string): "expired" | "warning" | "ok" {
  if (!doc.expiryDate) return "ok";
  if (doc.expiryDate < today) return "expired";
  if (doc.alertDays) {
    const alertDate = new Date(doc.expiryDate);
    alertDate.setDate(alertDate.getDate() - doc.alertDays);
    if (today >= alertDate.toISOString().slice(0, 10)) return "warning";
  }
  return "ok";
}

function AddDocumentDialog({
  open,
  onOpenChange,
  vehicles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicles: VehicleOption[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<State, FormData>(createVehicleDocumentAction, null);

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success("Document added.");
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Compliance Document</DialogTitle>
        </DialogHeader>
        <form id="doc-form" action={action} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="doc-vehicle">Vehicle *</Label>
            <select id="doc-vehicle" name="vehicleId" required className={SELECT_CLASS}>
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.regNumber}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Document Type *</Label>
            <select id="doc-type" name="docType" required className={SELECT_CLASS}>
              <option value="">Select type…</option>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-number">Document Number</Label>
            <Input id="doc-number" name="docNumber" placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-issue">Issue Date</Label>
              <Input id="doc-issue" name="issueDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-expiry">Expiry Date</Label>
              <Input id="doc-expiry" name="expiryDate" type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-alert">Alert (days before expiry)</Label>
            <Input id="doc-alert" name="alertDays" defaultValue="30" placeholder="30" />
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="doc-form" disabled={pending}>
            {pending ? "Saving…" : "Add Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  documents: DocumentRow[];
  vehicles: VehicleOption[];
  canManage: boolean;
};

export function ComplianceAlerts({ documents, vehicles, canManage }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  const sorted = [...documents].sort((a, b) => {
    const order = { expired: 0, warning: 1, ok: 2 };
    return order[alertStatus(a, today)] - order[alertStatus(b, today)];
  });

  function handleDelete(id: string) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const res = await deleteVehicleDocumentAction(id);
      setPendingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      if (res.success) { router.refresh(); toast.success("Document removed."); }
      else toast.error(res.error ?? "Failed.");
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canManage && (
          <Button size="sm" onClick={() => { setDialogKey((k) => k + 1); setOpen(true); }}>
            <Plus className="size-4 mr-1" /> Add Document
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No compliance documents" description="Add vehicle documents to track expiries." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Doc #</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((doc) => {
              const status = alertStatus(doc, today);
              return (
                <TableRow key={doc.id}>
                  <TableCell className="font-mono font-medium">{doc.regNumber}</TableCell>
                  <TableCell>{doc.docType}</TableCell>
                  <TableCell>{doc.docNumber ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{doc.expiryDate ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {status === "expired" && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Expired</Badge>
                    )}
                    {status === "warning" && (
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Expiring Soon</Badge>
                    )}
                    {status === "ok" && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Valid</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pendingIds.has(doc.id)}
                        onClick={() => handleDelete(doc.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <AddDocumentDialog key={dialogKey} open={open} onOpenChange={setOpen} vehicles={vehicles} />
    </>
  );
}
