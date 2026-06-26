"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Warehouse as WarehouseIcon } from "lucide-react";

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
import { WarehouseDialog } from "@/components/app/inventory/warehouse-dialog";
import { toggleWarehouseActiveAction } from "@/server/actions/inventory/warehouses";
import type { Warehouse } from "@/lib/db/schema";

type WarehousesTableProps = {
  warehouses: Warehouse[];
  canManage: boolean;
};

export function WarehousesTable({ warehouses, canManage }: WarehousesTableProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [togglePending, setTogglePending] = useState<Set<string>>(new Set());
  const [, startToggleTransition] = useTransition();

  function openCreate() {
    setEditingWarehouse(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(wh: Warehouse) {
    setEditingWarehouse(wh);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function handleToggle(wh: Warehouse) {
    const newActive = !wh.isActive;
    setTogglePending((prev) => new Set(prev).add(wh.id));
    startToggleTransition(async () => {
      try {
        const result = await toggleWarehouseActiveAction(wh.id, newActive);
        if (!result.success) {
          toast.error(result.error ?? "Failed to update warehouse.");
        } else {
          router.refresh();
        }
      } catch {
        toast.error("Failed to update warehouse.");
      } finally {
        setTogglePending((prev) => {
          const next = new Set(prev);
          next.delete(wh.id);
          return next;
        });
      }
    });
  }

  return (
    <div>
      {canManage && (
        <div className="flex justify-end mb-4">
          <Button onClick={openCreate}>New Warehouse</Button>
        </div>
      )}

      {warehouses.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          description="Add a warehouse to start tracking stock by location."
          action={
            canManage ? (
              <Button onClick={openCreate}>New Warehouse</Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.map((wh) => (
              <TableRow key={wh.id}>
                <TableCell className="font-mono font-medium">{wh.code}</TableCell>
                <TableCell>{wh.name}</TableCell>
                <TableCell className="text-muted-foreground">{wh.location ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={wh.isActive ? "default" : "secondary"}>
                    {wh.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(wh)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(wh)}
                      disabled={togglePending.has(wh.id)}
                    >
                      {togglePending.has(wh.id)
                        ? "…"
                        : wh.isActive
                        ? "Deactivate"
                        : "Activate"}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <WarehouseDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingWarehouse={editingWarehouse}
      />
    </div>
  );
}
