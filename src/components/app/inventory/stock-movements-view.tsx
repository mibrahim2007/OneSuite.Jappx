"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { createStockMoveAction } from "@/server/actions/inventory/stock-moves";
import { MOVE_TYPES, MOVE_TYPE_LABELS, type MoveType } from "@/lib/validations/inventory";
import { exportToCsv } from "@/lib/utils/export-csv";

type MoveRow = {
  id: string;
  moveType: MoveType;
  itemId: string;
  warehouseId: string;
  toWarehouseId: string | null;
  quantity: string;
  unitCost: string | null;
  reference: string | null;
  moveDate: string;
  createdBy: string;
  itemSku: string;
  itemName: string;
  fromWarehouseName: string;
  toWarehouseName: string | null;
};

type ItemOption = { id: string; sku: string; name: string };
type WarehouseOption = { id: string; code: string; name: string };

type Props = {
  moves: MoveRow[];
  activeItems: ItemOption[];
  activeWarehouses: WarehouseOption[];
  canCreate: boolean;
  canTransfer: boolean;
};

function moveTypeBadgeClass(type: MoveType): string {
  if (type === "receipt") return "bg-green-100 text-green-800 border-green-200";
  if (type === "issue") return "bg-red-100 text-red-800 border-red-200";
  if (type === "transfer") return "bg-blue-100 text-blue-800 border-blue-200";
  if (type === "adjustment") return "bg-amber-100 text-amber-800 border-amber-200";
  if (type === "return") return "bg-purple-100 text-purple-800 border-purple-200";
  return "";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- New Movement Dialog ---

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeItems: ItemOption[];
  activeWarehouses: WarehouseOption[];
  canTransfer: boolean;
  dialogKey: number;
};

function StockMoveDialog({
  open,
  onOpenChange,
  activeItems,
  activeWarehouses,
  canTransfer,
  dialogKey,
}: DialogProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createStockMoveAction, null);
  const [moveType, setMoveType] = useState<MoveType>("receipt");

  useEffect(() => {
    if (state?.success === false) toast.error(state.error);
    if (state?.success === true) {
      toast.success("Stock movement recorded.");
      router.refresh();
      onOpenChange(false);
    }
  }, [state, router, onOpenChange]);

  const showToWarehouse = moveType === "transfer";
  const showUnitCost = moveType === "receipt" || moveType === "return" || moveType === "adjustment";

  const availableTypes = canTransfer
    ? MOVE_TYPES
    : MOVE_TYPES.filter((t) => t !== "transfer");

  return (
    <Dialog key={dialogKey} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Stock Movement</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {/* Move Type */}
          <div className="space-y-1">
            <Label htmlFor="moveType">Type</Label>
            <select
              id="moveType"
              name="moveType"
              className={SELECT_CLASS}
              value={moveType}
              onChange={(e) => setMoveType(e.target.value as MoveType)}
              required
            >
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {MOVE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Item */}
          <div className="space-y-1">
            <Label htmlFor="itemId">Item</Label>
            <select id="itemId" name="itemId" className={SELECT_CLASS} required>
              <option value="">— Select item —</option>
              {activeItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} — {item.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Warehouse */}
          <div className="space-y-1">
            <Label htmlFor="warehouseId">
              {showToWarehouse ? "From Warehouse" : "Warehouse"}
            </Label>
            <select id="warehouseId" name="warehouseId" className={SELECT_CLASS} required>
              <option value="">— Select warehouse —</option>
              {activeWarehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} — {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Warehouse (transfer only) */}
          {showToWarehouse && (
            <div className="space-y-1">
              <Label htmlFor="toWarehouseId">To Warehouse</Label>
              <select id="toWarehouseId" name="toWarehouseId" className={SELECT_CLASS} required>
                <option value="">— Select warehouse —</option>
                {activeWarehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} — {wh.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-1">
            <Label htmlFor="quantity">Quantity</Label>
            <Input id="quantity" name="quantity" type="text" inputMode="decimal" placeholder="0.0000" required />
          </div>

          {/* Unit Cost (receipt / return / adjustment) */}
          {showUnitCost && (
            <div className="space-y-1">
              <Label htmlFor="unitCost">Unit Cost</Label>
              <Input id="unitCost" name="unitCost" type="text" inputMode="decimal" placeholder="0.0000" />
            </div>
          )}

          {/* Date */}
          <div className="space-y-1">
            <Label htmlFor="moveDate">Date</Label>
            <Input id="moveDate" name="moveDate" type="date" defaultValue={today()} required />
          </div>

          {/* Reference */}
          <div className="space-y-1">
            <Label htmlFor="reference">Reference</Label>
            <Input id="reference" name="reference" type="text" placeholder="PO#, Invoice#, etc." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Record Movement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Main View ---

export function StockMovementsView({
  moves,
  activeItems,
  activeWarehouses,
  canCreate,
  canTransfer,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  function openDialog() {
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock Movements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Record receipts, issues, transfers, and adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {moves.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCsv("stock-movements", moves as unknown as Record<string, unknown>[], [
                  { key: "moveDate", label: "Date" },
                  { key: "moveType", label: "Type" },
                  { key: "itemSku", label: "SKU" },
                  { key: "itemName", label: "Item" },
                  { key: "fromWarehouseName", label: "From Warehouse" },
                  { key: "toWarehouseName", label: "To Warehouse" },
                  { key: "quantity", label: "Quantity" },
                  { key: "unitCost", label: "Unit Cost" },
                  { key: "reference", label: "Reference" },
                ])
              }
            >
              Export CSV
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={openDialog}>
              <Plus className="h-4 w-4 mr-1" />
              New Movement
            </Button>
          )}
        </div>
      </div>

      {canCreate && (
        <StockMoveDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          activeItems={activeItems}
          activeWarehouses={activeWarehouses}
          canTransfer={canTransfer}
          dialogKey={dialogKey}
        />
      )}

      {moves.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No movements yet"
          description="Record your first stock movement to start tracking inventory changes."
          action={
            canCreate ? (
              <Button size="sm" onClick={openDialog}>
                New Movement
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>To Warehouse</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moves.map((move) => (
                <TableRow key={move.id}>
                  <TableCell className="tabular-nums text-sm">{move.moveDate}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${moveTypeBadgeClass(move.moveType)}`}
                    >
                      {MOVE_TYPE_LABELS[move.moveType]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{move.itemSku}</span>
                    <span className="ml-1.5 text-sm">{move.itemName}</span>
                  </TableCell>
                  <TableCell className="text-sm">{move.fromWarehouseName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {move.toWarehouseName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-mono text-sm">
                    {parseFloat(move.quantity).toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-mono text-sm">
                    {move.unitCost ? parseFloat(move.unitCost).toFixed(4) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {move.reference ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
