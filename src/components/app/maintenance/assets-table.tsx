"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { toast } from "sonner";

import { createAssetAction, updateAssetAction } from "@/server/actions/maintenance/assets";
import { SELECT_CLASS } from "@/lib/ui-constants";
import type { Asset } from "@/lib/db/schema";

type AssetRow = Pick<
  Asset,
  | "id" | "code" | "name" | "category" | "location" | "warehouseId"
  | "purchaseDate" | "purchaseCost" | "warrantyExpiry" | "meterReading"
  | "status" | "parentId" | "createdAt" | "updatedAt"
>;

type WarehouseOption = { id: string; name: string };

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-amber-100 text-amber-800",
  disposed: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}

function AssetFormDialog({
  open,
  dialogKey,
  asset,
  assets,
  warehouses,
  onClose,
}: {
  open: boolean;
  dialogKey: number;
  asset: AssetRow | null;
  assets: AssetRow[];
  warehouses: WarehouseOption[];
  onClose: () => void;
}) {
  const action = asset ? updateAssetAction : createAssetAction;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.success) {
      toast.success(asset ? "Asset updated." : "Asset created.");
      onClose();
    } else if (state && !state.success) {
      toast.error(state.error);
    }
  }, [state]);

  if (!open) return null;

  const parents = assets.filter((a) => a.id !== asset?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{asset ? "Edit Asset" : "New Asset"}</h2>
        <form key={dialogKey} action={formAction} className="space-y-3">
          {asset && <input type="hidden" name="id" value={asset.id} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Code *</label>
              <input name="code" defaultValue={asset?.code ?? ""} readOnly={!!asset}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 read-only:opacity-60"
                placeholder="AST-001" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select name="status" defaultValue={asset?.status ?? "active"} className={SELECT_CLASS}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="disposed">Disposed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input name="name" defaultValue={asset?.name ?? ""} required
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder="Air Compressor Unit 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input name="category" defaultValue={asset?.category ?? ""}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                placeholder="HVAC" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input name="location" defaultValue={asset?.location ?? ""}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                placeholder="Building A, Floor 2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Parent Asset</label>
              <select name="parentId" defaultValue={asset?.parentId ?? ""} className={SELECT_CLASS}>
                <option value="">None</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Warehouse</label>
              <select name="warehouseId" defaultValue={asset?.warehouseId ?? ""} className={SELECT_CLASS}>
                <option value="">None</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Date</label>
              <input type="date" name="purchaseDate" defaultValue={asset?.purchaseDate ?? ""}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Cost</label>
              <input type="number" step="0.01" min="0" name="purchaseCost"
                defaultValue={asset?.purchaseCost ?? ""}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Warranty Expiry</label>
              <input type="date" name="warrantyExpiry" defaultValue={asset?.warrantyExpiry ?? ""}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Meter Reading</label>
              <input type="number" step="0.01" min="0" name="meterReading"
                defaultValue={asset?.meterReading ?? "0"}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-input hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {pending ? "Saving…" : asset ? "Save Changes" : "Create Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AssetsTable({
  assets: assetRows,
  warehouses,
  canCreate,
  canEdit,
}: {
  assets: AssetRow[];
  warehouses: WarehouseOption[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [search, setSearch] = useState("");

  function openNew() {
    setEditingAsset(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(a: AssetRow) {
    setEditingAsset(a);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));
  const filtered = assetRows.filter(
    (a) =>
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.location ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets…"
          className="flex h-8 w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {canCreate && (
          <button onClick={openNew}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            + New Asset
          </button>
        )}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Code</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-left font-medium">Location</th>
              <th className="px-3 py-2 text-left font-medium">Warranty</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              {canEdit && <th className="px-3 py-2 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-3 py-8 text-center text-muted-foreground">
                  No assets found.
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const warrantyExpired = a.warrantyExpiry && a.warrantyExpiry < today;
                return (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{a.code}</td>
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.category ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.location ?? "—"}</td>
                    <td className="px-3 py-2">
                      {a.warrantyExpiry ? (
                        <span className={warrantyExpired ? "text-red-600 text-xs" : "text-xs"}>
                          {a.warrantyExpiry}
                          {warrantyExpired ? " (exp.)" : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                    {canEdit && (
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => openEdit(a)}
                          className="text-xs text-primary underline-offset-2 hover:underline">
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <AssetFormDialog
        open={dialogOpen}
        dialogKey={dialogKey}
        asset={editingAsset}
        assets={assetRows}
        warehouses={warehouses}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
