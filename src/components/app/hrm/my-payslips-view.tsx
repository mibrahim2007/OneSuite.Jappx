"use client";

type Employee = { id: string; fullName: string; empCode: string };
type SlipRow = {
  id: string;
  basic: string;
  allowances: string;
  deductions: string;
  tax: string;
  gross: string;
  net: string;
  periodMonth: string;
  runStatus: string;
};

type Props = { employee: Employee; payslips: SlipRow[] };

const fmt = (v: string) =>
  parseFloat(v).toLocaleString("en-PK", { minimumFractionDigits: 2 });

export function MyPayslipsView({ employee, payslips }: Props) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Payslips</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {employee.empCode} — {employee.fullName}
        </p>
      </div>

      {payslips.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No payslips available yet.</p>
      )}

      <div className="grid gap-4">
        {payslips.map((slip) => (
          <div key={slip.id} className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{slip.periodMonth}</h2>
              <span className="text-xs capitalize rounded-full px-2 py-0.5 bg-green-100 text-green-700">
                {slip.runStatus}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs mb-0.5">Basic</div>
                <div className="font-medium">{fmt(slip.basic)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-0.5">Allowances</div>
                <div className="font-medium">{fmt(slip.allowances)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-0.5">Gross</div>
                <div className="font-semibold">{fmt(slip.gross)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-0.5">Deductions</div>
                <div className="font-medium text-red-600">- {fmt(slip.deductions)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-0.5">Tax</div>
                <div className="font-medium text-red-600">- {fmt(slip.tax)}</div>
              </div>
              <div className="rounded-md bg-green-50 p-3 border border-green-200">
                <div className="text-muted-foreground text-xs mb-0.5">Net Pay</div>
                <div className="text-lg font-bold text-green-700">{fmt(slip.net)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
