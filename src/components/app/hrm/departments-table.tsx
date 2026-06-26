"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Briefcase } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SELECT_CLASS } from "@/lib/ui-constants";
import {
  createDepartmentAction,
  updateDepartmentAction,
  createDesignationAction,
  updateDesignationAction,
} from "@/server/actions/hrm/departments";
import type { Department, Designation } from "@/lib/db/schema";

type Props = {
  departments: Department[];
  designations: Designation[];
  canEdit: boolean;
};

// ---- Department Dialog ----

function DeptDialog({
  open, dialogKey, dept, departments, onClose,
}: {
  open: boolean;
  dialogKey: number;
  dept: Department | null;
  departments: Department[];
  onClose: () => void;
}) {
  const action = dept ? updateDepartmentAction : createDepartmentAction;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) { toast.success("Saved."); onClose(); }
    else toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{dept ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
        <form key={dialogKey} action={formAction} className="space-y-3">
          {dept && <input type="hidden" name="id" value={dept.id} />}
          <div>
            <Label htmlFor="dept-name">Name *</Label>
            <Input id="dept-name" name="name" defaultValue={dept?.name ?? ""} required />
          </div>
          <div>
            <Label htmlFor="dept-parent">Parent Department</Label>
            <select id="dept-parent" name="parentId" defaultValue={dept?.parentId ?? ""} className={SELECT_CLASS}>
              <option value="">— top level —</option>
              {departments.filter((d) => d.id !== dept?.id).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Designation Dialog ----

function DesigDialog({
  open, dialogKey, desig, onClose,
}: {
  open: boolean;
  dialogKey: number;
  desig: Designation | null;
  onClose: () => void;
}) {
  const action = desig ? updateDesignationAction : createDesignationAction;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) { toast.success("Saved."); onClose(); }
    else toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{desig ? "Edit Designation" : "Add Designation"}</DialogTitle></DialogHeader>
        <form key={dialogKey} action={formAction} className="space-y-3">
          {desig && <input type="hidden" name="id" value={desig.id} />}
          <div>
            <Label htmlFor="desig-title">Title *</Label>
            <Input id="desig-title" name="title" defaultValue={desig?.title ?? ""} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Component ----

export function DepartmentsTable({ departments, designations, canEdit }: Props) {
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [deptDialogKey, setDeptDialogKey] = useState(0);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const [desigDialogOpen, setDesigDialogOpen] = useState(false);
  const [desigDialogKey, setDesigDialogKey] = useState(0);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);

  function openDept(dept: Department | null) {
    setEditingDept(dept);
    setDeptDialogKey((k) => k + 1);
    setDeptDialogOpen(true);
  }

  function openDesig(desig: Designation | null) {
    setEditingDesig(desig);
    setDesigDialogKey((k) => k + 1);
    setDesigDialogOpen(true);
  }

  return (
    <div className="space-y-8">
      {/* Departments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Departments</h1>
          {canEdit && <Button size="sm" onClick={() => openDept(null)}>Add Department</Button>}
        </div>
        {departments.length === 0 ? (
          <EmptyState icon={Building2} title="No departments" description="Create your first department." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Parent</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{departments.find((p) => p.id === d.parentId)?.name ?? "—"}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openDept(d)}>Edit</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Designations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Designations</h2>
          {canEdit && <Button size="sm" onClick={() => openDesig(null)}>Add Designation</Button>}
        </div>
        {designations.length === 0 ? (
          <EmptyState icon={Briefcase} title="No designations" description="Create your first designation." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {designations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openDesig(d)}>Edit</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DeptDialog
        open={deptDialogOpen}
        dialogKey={deptDialogKey}
        dept={editingDept}
        departments={departments}
        onClose={() => setDeptDialogOpen(false)}
      />
      <DesigDialog
        open={desigDialogOpen}
        dialogKey={desigDialogKey}
        desig={editingDesig}
        onClose={() => setDesigDialogOpen(false)}
      />
    </div>
  );
}
