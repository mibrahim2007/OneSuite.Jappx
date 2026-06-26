"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package } from "lucide-react";

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
import { ItemDialog } from "@/components/app/inventory/item-dialog";
import { toggleItemActiveAction } from "@/server/actions/inventory/items";
import { VALUATION_METHOD_LABELS } from "@/lib/validations/inventory";
import { exportToCsv } from "@/lib/utils/export-csv";
import type { ItemCategory, Uom } from "@/lib/db/schema";

type AccountOption = { id: string; code: string; name: string; type: string };

type ItemRow = {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  uomId: string | null;
  barcode: string | null;
  isStock: boolean;
  valuation: "fifo" | "weighted_average" | "standard";
  purchasePrice: string | null;
  salePrice: string | null;
  reorderLevel: string | null;
  inventoryAccountId: string | null;
  isActive: boolean;
  categoryName: string | null;
  uomCode: string | null;
};

type ItemsTableProps = {
  items: ItemRow[];
  categories: ItemCategory[];
  uoms: Uom[];
  accounts: AccountOption[];
  canCreate: boolean;
  canEdit: boolean;
};

export function ItemsTable({ items, categories, uoms, accounts, canCreate, canEdit }: ItemsTableProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [togglePending, setTogglePending] = useState<Set<string>>(new Set());
  const [, startToggleTransition] = useTransition();

  function openNew() {
    setEditingItem(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(item: ItemRow) {
    setEditingItem(item);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function handleToggle(id: string, currentlyActive: boolean) {
    setTogglePending((prev) => new Set(prev).add(id));
    startToggleTransition(async () => {
      try {
        const result = await toggleItemActiveAction(id, !currentlyActive);
        if (!result.success) {
          toast.error(result.error ?? "Failed to update status.");
        } else {
          router.refresh();
          toast.success(currentlyActive ? "Item deactivated." : "Item activated.");
        }
      } catch {
        toast.error("Failed to update item status.");
      } finally {
        setTogglePending((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Products and services in your catalogue.
        </p>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCsv("items", items as unknown as Record<string, unknown>[], [
                  { key: "sku", label: "SKU" },
                  { key: "name", label: "Name" },
                  { key: "categoryName", label: "Category" },
                  { key: "uomCode", label: "UoM" },
                  { key: "purchasePrice", label: "Purchase Price" },
                  { key: "salePrice", label: "Sale Price" },
                  { key: "reorderLevel", label: "Reorder Level" },
                  { key: "isActive", label: "Active" },
                ])
              }
            >
              Export CSV
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={openNew}>
              New Item
            </Button>
          )}
        </div>
      </div>

      <ItemDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        categories={categories}
        uoms={uoms}
        accounts={accounts}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items yet"
          description="Add your first product or service to get started."
          action={
            canCreate ? (
              <Button size="sm" onClick={openNew}>
                Add Item
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Valuation</TableHead>
              <TableHead>Sale Price</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                className={!item.isActive ? "opacity-60" : undefined}
              >
                <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {item.categoryName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.uomCode ?? "—"}
                </TableCell>
                <TableCell>
                  {item.isStock ? (
                    <Badge variant="outline">Stock</Badge>
                  ) : (
                    <Badge variant="secondary">Service</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {item.isStock ? (VALUATION_METHOD_LABELS[item.valuation] ?? item.valuation) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.salePrice ? parseFloat(item.salePrice).toFixed(2) : "—"}
                </TableCell>
                <TableCell>
                  {item.isActive ? (
                    <Badge variant="outline">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={togglePending.has(item.id)}
                        onClick={() => handleToggle(item.id, item.isActive)}
                      >
                        {togglePending.has(item.id)
                          ? "…"
                          : item.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
