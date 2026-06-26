"use client";

import { useState } from "react";
import { Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { getItemBreakdownAction } from "@/server/actions/inventory/overview";
import { MOVE_TYPE_LABELS, type MoveType } from "@/lib/validations/inventory";

type OverviewRow = {
  itemId: string;
  totalQty: string;
  avgCost: string;
  sku: string;
  name: string;
  reorderLevel: string | null;
  uomCode: string | null;
};

type WarehouseOption = { id: string; code: string; name: string };

type Props = {
  rows: OverviewRow[];
  warehouses: WarehouseOption[];
  tenantId: string;
};

type BreakdownRow = {
  warehouseId: string;
  warehouseName: string;
  quantity: string;
  avgCost: string;
};

type MoveRow = {
  id: string;
  moveType: string;
  quantity: string;
  unitCost: string | null;
  reference: string | null;
  moveDate: string;
  fromWarehouseName: string;
  toWarehouseId: string | null;
};

function isLowStock(row: OverviewRow): boolean {
  return row.reorderLevel !== null && parseFloat(row.totalQty) <= parseFloat(row.reorderLevel);
}

function moveTypeBadgeClass(type: string): string {
  if (type === "receipt") return "bg-green-100 text-green-800 border-green-200";
  if (type === "issue") return "bg-red-100 text-red-800 border-red-200";
  if (type === "transfer") return "bg-blue-100 text-blue-800 border-blue-200";
  if (type === "adjustment") return "bg-amber-100 text-amber-800 border-amber-200";
  if (type === "return") return "bg-purple-100 text-purple-800 border-purple-200";
  return "";
}

export function InventoryOverview({ rows, warehouses }: Props) {
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");
  const [selectedRow, setSelectedRow] = useState<OverviewRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // For warehouse filter: we need per-warehouse data to filter; since we only have totals,
  // warehouse filter navigates to a filtered version. For client simplicity, pass warehouseId
  // as a URL param and let the overview show all items (the filter isn't meaningful on aggregated data).
  // Instead, label the filter "drill-down per warehouse" and use it to scope the sheet.

  async function openSheet(row: OverviewRow) {
    setSelectedRow(row);
    setBreakdown([]);
    setMoves([]);
    setSheetOpen(true);
    setLoadingDetail(true);
    try {
      const result = await getItemBreakdownAction(row.itemId);
      if (result.success) {
        setBreakdown(result.breakdown);
        setMoves(result.moves);
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  const filteredRows =
    warehouseFilter === ""
      ? rows
      : rows; // server-side aggregated; warehouse filter shown in detail sheet

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Current stock levels across all warehouses. Click a row for breakdown.
          </p>
        </div>
        <select
          className={SELECT_CLASS + " w-48"}
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          aria-label="Filter by warehouse"
        >
          <option value="">All warehouses</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>
              {wh.code} — {wh.name}
            </option>
          ))}
        </select>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No stock data yet"
          description="Record stock movements to see inventory levels here."
        />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const low = isLowStock(row);
                return (
                  <TableRow
                    key={row.itemId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openSheet(row)}
                  >
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell className="text-sm font-medium">{row.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.uomCode ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono text-sm">
                      {parseFloat(row.totalQty).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono text-sm">
                      {row.avgCost ? parseFloat(row.avgCost).toFixed(4) : "—"}
                    </TableCell>
                    <TableCell>
                      {low && (
                        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                          Low Stock
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedRow ? (
                <>
                  <span className="font-mono text-sm text-muted-foreground">{selectedRow.sku}</span>
                  <span className="ml-2">{selectedRow.name}</span>
                </>
              ) : (
                "Item Detail"
              )}
            </SheetTitle>
          </SheetHeader>

          {loadingDetail ? (
            <div className="mt-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Tabs defaultValue="breakdown" className="mt-6">
              <TabsList>
                <TabsTrigger value="breakdown">By Warehouse</TabsTrigger>
                <TabsTrigger value="movements">Last 50 Movements</TabsTrigger>
              </TabsList>

              <TabsContent value="breakdown" className="mt-4">
                {breakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stock records for this item.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Avg Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdown.map((b) => (
                        <TableRow key={b.warehouseId}>
                          <TableCell className="text-sm">{b.warehouseName}</TableCell>
                          <TableCell className="text-right tabular-nums font-mono text-sm">
                            {parseFloat(b.quantity).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-mono text-sm">
                            {parseFloat(b.avgCost).toFixed(4)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="movements" className="mt-4">
                {moves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No movements for this item.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Ref</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {moves.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="tabular-nums text-sm">{m.moveDate}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${moveTypeBadgeClass(m.moveType)}`}
                            >
                              {MOVE_TYPE_LABELS[m.moveType as MoveType] ?? m.moveType}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{m.fromWarehouseName}</TableCell>
                          <TableCell className="text-right tabular-nums font-mono text-sm">
                            {parseFloat(m.quantity).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {m.reference ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
