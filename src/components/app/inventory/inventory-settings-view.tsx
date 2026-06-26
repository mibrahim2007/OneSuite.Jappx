"use client";

import {
  useActionState,
  useEffect,
  useTransition,
  startTransition,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tag, Ruler } from "lucide-react";

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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { SELECT_CLASS } from "@/lib/ui-constants";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/server/actions/inventory/categories";
import {
  createUomAction,
  updateUomAction,
  deleteUomAction,
} from "@/server/actions/inventory/uoms";
import type { ItemCategory, Uom } from "@/lib/db/schema";

type Props = {
  categories: ItemCategory[];
  uoms: Uom[];
  canManage: boolean;
};

// --- Category Dialog ---

type CategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ItemCategory | null;
  categories: ItemCategory[];
};

function CategoryDialog({ open, onOpenChange, editing, categories }: CategoryDialogProps) {
  const router = useRouter();

  const [createState, createFormAction, createPending] = useActionState(createCategoryAction, null);
  const [updateState, updateFormAction, updatePending] = useActionState(updateCategoryAction, null);

  const state = editing ? updateState : createState;
  const formAction = editing ? updateFormAction : createFormAction;
  const isPending = editing ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editing ? "Category updated." : "Category created.");
    }
  }, [state, editing, onOpenChange, router]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  const parentOptions = categories.filter((c) => !editing || c.id !== editing.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <form id="category-form" onSubmit={onSubmit} className="space-y-4 pt-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              name="name"
              defaultValue={editing?.name ?? ""}
              placeholder="e.g. Electronics"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-parent">Parent Category (optional)</Label>
            <select
              id="cat-parent"
              name="parentId"
              defaultValue={editing?.parentId ?? ""}
              className={SELECT_CLASS}
            >
              <option value="">No parent</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </form>
        {state && !state.success && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <DialogFooter showCloseButton>
          <Button type="submit" form="category-form" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- UoM Dialog ---

type UomDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Uom | null;
};

function UomDialog({ open, onOpenChange, editing }: UomDialogProps) {
  const router = useRouter();

  const [createState, createFormAction, createPending] = useActionState(createUomAction, null);
  const [updateState, updateFormAction, updatePending] = useActionState(updateUomAction, null);

  const state = editing ? updateState : createState;
  const formAction = editing ? updateFormAction : createFormAction;
  const isPending = editing ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editing ? "UoM updated." : "UoM created.");
    }
  }, [state, editing, onOpenChange, router]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Unit of Measure" : "New Unit of Measure"}</DialogTitle>
        </DialogHeader>
        <form id="uom-form" onSubmit={onSubmit} className="space-y-4 pt-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="uom-code">Code</Label>
            <Input
              id="uom-code"
              name="code"
              defaultValue={editing?.code ?? ""}
              placeholder="e.g. PCS"
              className="uppercase"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uom-name">Name</Label>
            <Input
              id="uom-name"
              name="name"
              defaultValue={editing?.name ?? ""}
              placeholder="e.g. Pieces"
            />
          </div>
        </form>
        {state && !state.success && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <DialogFooter showCloseButton>
          <Button type="submit" form="uom-form" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main View ---

export function InventorySettingsView({ categories, uoms, canManage }: Props) {
  const router = useRouter();

  // Category dialog state
  const [catOpen, setCatOpen] = useState(false);
  const [catDialogKey, setCatDialogKey] = useState(0);
  const [editingCat, setEditingCat] = useState<ItemCategory | null>(null);
  const [catDeletePending, setCatDeletePending] = useState<Set<string>>(new Set());
  const [, startCatDeleteTransition] = useTransition();

  // UoM dialog state
  const [uomOpen, setUomOpen] = useState(false);
  const [uomDialogKey, setUomDialogKey] = useState(0);
  const [editingUom, setEditingUom] = useState<Uom | null>(null);
  const [uomDeletePending, setUomDeletePending] = useState<Set<string>>(new Set());
  const [, startUomDeleteTransition] = useTransition();

  function openNewCat() {
    setEditingCat(null);
    setCatDialogKey((k) => k + 1);
    setCatOpen(true);
  }

  function openEditCat(cat: ItemCategory) {
    setEditingCat(cat);
    setCatDialogKey((k) => k + 1);
    setCatOpen(true);
  }

  function handleDeleteCat(id: string) {
    setCatDeletePending((prev) => new Set(prev).add(id));
    startCatDeleteTransition(async () => {
      try {
        const result = await deleteCategoryAction(id);
        if (!result.success) {
          toast.error(result.error ?? "Failed to delete category.");
        } else {
          router.refresh();
          toast.success("Category deleted.");
        }
      } catch {
        toast.error("Failed to delete category.");
      } finally {
        setCatDeletePending((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
    });
  }

  function openNewUom() {
    setEditingUom(null);
    setUomDialogKey((k) => k + 1);
    setUomOpen(true);
  }

  function openEditUom(u: Uom) {
    setEditingUom(u);
    setUomDialogKey((k) => k + 1);
    setUomOpen(true);
  }

  function handleDeleteUom(id: string) {
    setUomDeletePending((prev) => new Set(prev).add(id));
    startUomDeleteTransition(async () => {
      try {
        const result = await deleteUomAction(id);
        if (!result.success) {
          toast.error(result.error ?? "Failed to delete UoM.");
        } else {
          router.refresh();
          toast.success("Unit of measure deleted.");
        }
      } catch {
        toast.error("Failed to delete unit of measure.");
      } finally {
        setUomDeletePending((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
    });
  }

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <>
      <CategoryDialog
        key={catDialogKey}
        open={catOpen}
        onOpenChange={setCatOpen}
        editing={editingCat}
        categories={categories}
      />
      <UomDialog
        key={`uom-${uomDialogKey}`}
        open={uomOpen}
        onOpenChange={setUomOpen}
        editing={editingUom}
      />

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Item Categories</TabsTrigger>
          <TabsTrigger value="uom">Units of Measure</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Organize items into categories and sub-categories.
              </p>
              {canManage && (
                <Button size="sm" onClick={openNewCat}>
                  New Category
                </Button>
              )}
            </div>
            {categories.length === 0 ? (
              <EmptyState
                icon={Tag}
                title="No categories yet"
                description="Add item categories to organize your products."
                action={
                  canManage ? (
                    <Button size="sm" onClick={openNewCat}>
                      Add Category
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Parent</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {cat.parentId ? (categoryById[cat.parentId] ?? "—") : "—"}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditCat(cat)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={catDeletePending.has(cat.id)}
                              onClick={() => handleDeleteCat(cat.id)}
                            >
                              {catDeletePending.has(cat.id) ? "…" : "Delete"}
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
        </TabsContent>

        <TabsContent value="uom" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Define units of measure for tracking quantities.
              </p>
              {canManage && (
                <Button size="sm" onClick={openNewUom}>
                  New UoM
                </Button>
              )}
            </div>
            {uoms.length === 0 ? (
              <EmptyState
                icon={Ruler}
                title="No units of measure yet"
                description="Add units of measure such as Pieces, Kg, or Liters."
                action={
                  canManage ? (
                    <Button size="sm" onClick={openNewUom}>
                      Add UoM
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uoms.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">{u.code}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditUom(u)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={uomDeletePending.has(u.id)}
                              onClick={() => handleDeleteUom(u.id)}
                            >
                              {uomDeletePending.has(u.id) ? "…" : "Delete"}
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
        </TabsContent>
      </Tabs>
    </>
  );
}
