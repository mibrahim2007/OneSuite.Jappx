"use client";

import {
  useActionState,
  useEffect,
  startTransition,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { createItemAction, updateItemAction } from "@/server/actions/inventory/items";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { VALUATION_METHODS, VALUATION_METHOD_LABELS } from "@/lib/validations/inventory";
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
};

type ItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: ItemRow | null;
  categories: ItemCategory[];
  uoms: Uom[];
  accounts: AccountOption[];
};

type FormProps = {
  editingItem: ItemRow | null;
  categories: ItemCategory[];
  uoms: Uom[];
  accounts: AccountOption[];
  formAction: (formData: FormData) => void;
};

function ItemForm({ editingItem, categories, uoms, accounts, formAction }: FormProps) {
  const [isStock, setIsStock] = useState(editingItem?.isStock ?? true);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("isStock", isStock ? "true" : "false");
    startTransition(() => formAction(fd));
  }

  return (
    <form id="item-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
      {editingItem && <input type="hidden" name="id" value={editingItem.id} />}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="item-sku">SKU *</Label>
          <Input
            id="item-sku"
            name="sku"
            defaultValue={editingItem?.sku ?? ""}
            placeholder="e.g. ITM-001"
            disabled={!!editingItem}
            className={editingItem ? "bg-muted" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-barcode">Barcode</Label>
          <Input
            id="item-barcode"
            name="barcode"
            defaultValue={editingItem?.barcode ?? ""}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item-name">Name *</Label>
        <Input
          id="item-name"
          name="name"
          defaultValue={editingItem?.name ?? ""}
          placeholder="e.g. Steel Rod 10mm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="item-category">Category</Label>
          <select
            id="item-category"
            name="categoryId"
            defaultValue={editingItem?.categoryId ?? ""}
            className={SELECT_CLASS}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-uom">Unit of Measure</Label>
          <select
            id="item-uom"
            name="uomId"
            defaultValue={editingItem?.uomId ?? ""}
            className={SELECT_CLASS}
          >
            <option value="">No UoM</option>
            {uoms.map((u) => (
              <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="item-purchase-price">Purchase Price</Label>
          <Input
            id="item-purchase-price"
            name="purchasePrice"
            type="number"
            step="0.0001"
            min="0"
            defaultValue={editingItem?.purchasePrice ?? ""}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-sale-price">Sale Price</Label>
          <Input
            id="item-sale-price"
            name="salePrice"
            type="number"
            step="0.0001"
            min="0"
            defaultValue={editingItem?.salePrice ?? ""}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="item-is-stock"
          checked={isStock}
          onChange={(e) => setIsStock(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor="item-is-stock">Stock item (tracked in inventory)</Label>
      </div>

      {isStock && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="item-reorder">Reorder Level</Label>
              <Input
                id="item-reorder"
                name="reorderLevel"
                type="number"
                step="0.0001"
                min="0"
                defaultValue={editingItem?.reorderLevel ?? ""}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-valuation">Valuation Method</Label>
              <select
                id="item-valuation"
                name="valuation"
                defaultValue={editingItem?.valuation ?? "weighted_average"}
                className={SELECT_CLASS}
              >
                {VALUATION_METHODS.map((v) => (
                  <option key={v} value={v}>{VALUATION_METHOD_LABELS[v]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-inv-account">Inventory GL Account</Label>
            <select
              id="item-inv-account"
              name="inventoryAccountId"
              defaultValue={editingItem?.inventoryAccountId ?? ""}
              className={SELECT_CLASS}
            >
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </form>
  );
}

export function ItemDialog({
  open,
  onOpenChange,
  editingItem,
  categories,
  uoms,
  accounts,
}: ItemDialogProps) {
  const router = useRouter();
  const [createState, createFormAction, createPending] = useActionState(createItemAction, null);
  const [updateState, updateFormAction, updatePending] = useActionState(updateItemAction, null);

  const state = editingItem ? updateState : createState;
  const formAction = editingItem ? updateFormAction : createFormAction;
  const isPending = editingItem ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editingItem ? "Item updated." : "Item created.");
    }
  }, [state, editingItem, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit Item" : "New Item"}</DialogTitle>
        </DialogHeader>

        <ItemForm
          key={editingItem?.id ?? "new"}
          editingItem={editingItem}
          categories={categories}
          uoms={uoms}
          accounts={accounts}
          formAction={formAction}
        />

        {state && !state.success && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <DialogFooter showCloseButton>
          <Button type="submit" form="item-form" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
