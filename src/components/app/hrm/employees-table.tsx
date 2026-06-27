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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      (!q || e.empCode.toLowerCase().includes(q) || e.fullName.toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q)) &&
      (statusFilter === "all" || e.status === statusFilter) &&
      (deptFilter === "all" || e.departmentId === deptFilter)
    );
  });

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

      {employees.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="search"
            placeholder="Search name, code, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-8 w-56 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 w-36"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="probation">Probation</option>
            <option value="on_leave">On Leave</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
          </select>
          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="flex h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 w-40"
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          {(search || statusFilter !== "all" || deptFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); setDeptFilter("all"); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {employees.length}</span>
        </div>
      )}

      {employees.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No employees"
          description="Add your first employee to get started."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserRound} title="No matching employees" description="Try adjusting your search or filters." />
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
            {filtered.map((emp) => (
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
