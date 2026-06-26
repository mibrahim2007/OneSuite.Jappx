"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { SELECT_CLASS } from "@/lib/ui-constants";
import { MOVE_TYPES, MOVE_TYPE_LABELS, type MoveType } from "@/lib/validations/inventory";

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
  itemSku: string;
  itemName: string;
  fromWarehouseName: string;
  toWarehouseName: string | null;
};

type ItemOption = { id: string; sku: string; name: string };
type WarehouseOption = { id: string; code: string; name: string };

type Filters = {
  item: string;
  warehouse: string;
  type: string;
  from: string;
  to: string;
};

type Props = {
  moves: MoveRow[];
  allItems: ItemOption[];
  allWarehouses: WarehouseOption[];
  filters: Filters;
};

function moveTypeBadgeClass(type: MoveType): string {
  if (type === "receipt") return "bg-green-100 text-green-800 border-green-200";
  if (type === "issue") return "bg-red-100 text-red-800 border-red-200";
  if (type === "transfer") return "bg-blue-100 text-blue-800 border-blue-200";
  if (type === "adjustment") return "bg-amber-100 text-amber-800 border-amber-200";
  if (type === "return") return "bg-purple-100 text-purple-800 border-purple-200";
  return "";
}

export function StockLedger({ moves, allItems, allWarehouses, filters }: Props) {
  const router = useRouter();

  function applyFilters(overrides: Partial<Filters>) {
    const merged = { ...filters, ...overrides };
    const params = new URLSearchParams();
    if (merged.item) params.set("item", merged.item);
    if (merged.warehouse) params.set("warehouse", merged.warehouse);
    if (merged.type) params.set("type", merged.type);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    router.push(`/app/inventory/ledger?${params.toString()}` as Route);
  }

  function clearFilters() {
    router.push("/app/inventory/ledger" as Route);
  }

  const hasFilters = filters.item || filters.warehouse || filters.type || filters.from || filters.to;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Stock Ledger</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Complete movement history. Showing up to 200 records.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="rounded-md border bg-muted/30 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Item</Label>
            <select
              className={SELECT_CLASS}
              value={filters.item}
              onChange={(e) => applyFilters({ item: e.target.value })}
            >
              <option value="">All items</option>
              {allItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} — {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Warehouse</Label>
            <select
              className={SELECT_CLASS}
              value={filters.warehouse}
              onChange={(e) => applyFilters({ warehouse: e.target.value })}
            >
              <option value="">All warehouses</option>
              {allWarehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} — {wh.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <select
              className={SELECT_CLASS}
              value={filters.type}
              onChange={(e) => applyFilters({ type: e.target.value })}
            >
              <option value="">All types</option>
              {MOVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">From date</Label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => applyFilters({ from: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">To date</Label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => applyFilters({ to: e.target.value })}
            />
          </div>
        </div>

        {hasFilters && (
          <div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Results */}
      {moves.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No movements found"
          description={hasFilters ? "No movements match the current filters." : "No stock movements have been recorded yet."}
          action={
            hasFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
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
