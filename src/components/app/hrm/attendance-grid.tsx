"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";

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
import { SELECT_CLASS } from "@/lib/ui-constants";
import { upsertAttendanceAction } from "@/server/actions/hrm/attendance";
import { ATTENDANCE_STATUSES } from "@/lib/validations/hrm";
import type { Attendance } from "@/lib/db/schema";

type EmpRow = { id: string; empCode: string; fullName: string };

type Props = {
  employees: EmpRow[];
  attendanceRecords: Attendance[];
  canManage: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  leave: "Leave",
  half_day: "Half Day",
  holiday: "Holiday",
  weekend: "Weekend",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

// One-row upsert form
function AttendanceRow({
  emp,
  record,
  date,
}: {
  emp: EmpRow;
  record: Attendance | undefined;
  date: string;
}) {
  const [state, formAction, pending] = useActionState(upsertAttendanceAction, null);

  useEffect(() => {
    if (!state) return;
    if (!state.success) toast.error(state.error);
  }, [state]);

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{emp.empCode}</TableCell>
      <TableCell>{emp.fullName}</TableCell>
      <TableCell colSpan={2}>
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="employeeId" value={emp.id} />
          <input type="hidden" name="attDate" value={date} />
          <select name="status" defaultValue={record?.status ?? "present"} className={`${SELECT_CLASS} w-32`}>
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
            ))}
          </select>
          <Input
            name="workedHours"
            type="number"
            step="0.25"
            min="0"
            max="24"
            defaultValue={record?.workedHours ?? ""}
            placeholder="Hours"
            className="w-24"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "…" : "Save"}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

export function AttendanceGrid({ employees, attendanceRecords, canManage }: Props) {
  const [selectedDate, setSelectedDate] = useState(today());

  const dayRecords = new Map(
    attendanceRecords
      .filter((r) => r.attDate === selectedDate)
      .map((r) => [r.employeeId, r])
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Attendance</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="att-date" className="text-sm">Date</Label>
          <Input
            id="att-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {employees.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No employees"
          description="Add employees before recording attendance."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) =>
              canManage ? (
                <AttendanceRow
                  key={emp.id}
                  emp={emp}
                  record={dayRecords.get(emp.id)}
                  date={selectedDate}
                />
              ) : (
                <TableRow key={emp.id}>
                  <TableCell className="font-mono text-xs">{emp.empCode}</TableCell>
                  <TableCell>{emp.fullName}</TableCell>
                  <TableCell>
                    {STATUS_LABELS[dayRecords.get(emp.id)?.status ?? ""] ?? "—"}
                  </TableCell>
                  <TableCell>{dayRecords.get(emp.id)?.workedHours ?? "—"}</TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
