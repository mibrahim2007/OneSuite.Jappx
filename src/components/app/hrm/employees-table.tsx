"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";

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
import { EmployeeDialog } from "@/components/app/hrm/employee-dialog";
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
  departmentName: string | null;
  designationTitle: string | null;
};

type Props = {
  employees: EmployeeRow[];
  departments: Department[];
  designations: Designation[];
  canCreate: boolean;
  canEdit: boolean;
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  probation: "bg-yellow-100 text-yellow-800",
  on_leave: "bg-blue-100 text-blue-800",
  resigned: "bg-gray-100 text-gray-600",
  terminated: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  probation: "Probation",
  on_leave: "On Leave",
  resigned: "Resigned",
  terminated: "Terminated",
};

export function EmployeesTable({ employees, departments, designations, canCreate, canEdit }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(row: EmployeeRow) {
    setEditing(row);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employees</h1>
        {canCreate && (
          <Button size="sm" onClick={openCreate}>Add Employee</Button>
        )}
      </div>

      {employees.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No employees"
          description="Add your first employee to get started."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-mono text-xs">{emp.empCode}</TableCell>
                <TableCell>
                  <div className="font-medium">{emp.fullName}</div>
                  {emp.email && <div className="text-xs text-muted-foreground">{emp.email}</div>}
                </TableCell>
                <TableCell>{emp.departmentName ?? "—"}</TableCell>
                <TableCell>{emp.designationTitle ?? "—"}</TableCell>
                <TableCell className="text-sm">{emp.joinDate ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE[emp.status] ?? ""}>
                    {STATUS_LABELS[emp.status] ?? emp.status}
                  </Badge>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(emp)}>Edit</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <EmployeeDialog
        open={dialogOpen}
        dialogKey={dialogKey}
        employee={editing}
        departments={departments}
        designations={designations}
        managers={employees}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
