"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { createEmployeeAction, updateEmployeeAction } from "@/server/actions/hrm/employees";
import { EMPLOYMENT_STATUSES } from "@/lib/validations/hrm";
import type { Department, Designation } from "@/lib/db/schema";

type EmployeeRow = {
  id: string;
  empCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  designationId: string | null;
  managerId: string | null;
  joinDate: string | null;
  status: "active" | "probation" | "on_leave" | "resigned" | "terminated";
  cnic: string | null;
};

type Props = {
  open: boolean;
  dialogKey: number;
  employee: EmployeeRow | null;
  departments: Department[];
  designations: Designation[];
  managers: { id: string; empCode: string; fullName: string }[];
  onClose: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  probation: "Probation",
  on_leave: "On Leave",
  resigned: "Resigned",
  terminated: "Terminated",
};

export function EmployeeDialog({ open, dialogKey, employee, departments, designations, managers, onClose }: Props) {
  const action = employee ? updateEmployeeAction : createEmployeeAction;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(employee ? "Employee updated." : "Employee created.");
      onClose();
    } else {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit Employee" : "Add Employee"}</DialogTitle>
        </DialogHeader>
        <form key={dialogKey} action={formAction} className="space-y-3">
          {employee && <input type="hidden" name="id" value={employee.id} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="empCode">Emp Code *</Label>
              <Input id="empCode" name="empCode" defaultValue={employee?.empCode ?? ""} disabled={!!employee} required />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue={employee?.status ?? "active"} className={SELECT_CLASS}>
                {EMPLOYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="fullName">Full Name *</Label>
            <Input id="fullName" name="fullName" defaultValue={employee?.fullName ?? ""} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={employee?.phone ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <select id="departmentId" name="departmentId" defaultValue={employee?.departmentId ?? ""} className={SELECT_CLASS}>
                <option value="">— none —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="designationId">Designation</Label>
              <select id="designationId" name="designationId" defaultValue={employee?.designationId ?? ""} className={SELECT_CLASS}>
                <option value="">— none —</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="managerId">Manager</Label>
              <select id="managerId" name="managerId" defaultValue={employee?.managerId ?? ""} className={SELECT_CLASS}>
                <option value="">— none —</option>
                {managers.filter((m) => m.id !== employee?.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.empCode} — {m.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="joinDate">Join Date</Label>
              <Input id="joinDate" name="joinDate" type="date" defaultValue={employee?.joinDate ?? ""} />
            </div>
          </div>

          <div>
            <Label htmlFor="cnic">CNIC</Label>
            <Input id="cnic" name="cnic" defaultValue={employee?.cnic ?? ""} placeholder="xxxxx-xxxxxxx-x" />
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
