import {
  FileText,
  FileInput,
  Banknote,
  ShoppingCart,
  PackageCheck,
  UserPlus,
  FileEdit,
  UserRound,
  Route,
  Truck,
  Wrench,
  Package,
} from "lucide-react";

export type QuickActionItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permCode: string;
};

export const QUICK_ACTIONS: QuickActionItem[] = [
  { label: "New Invoice",        icon: FileText,     permCode: "accounts:invoice:create" },
  { label: "New Bill",           icon: FileInput,    permCode: "accounts:bill:create" },
  { label: "Record Payment",     icon: Banknote,     permCode: "accounts:payment:create" },
  { label: "New Purchase Order", icon: ShoppingCart, permCode: "scm:po:create" },
  { label: "Receive Stock",      icon: PackageCheck, permCode: "scm:grn:create" },
  { label: "New Lead",           icon: UserPlus,     permCode: "crm:lead:create" },
  { label: "New Quotation",      icon: FileEdit,     permCode: "crm:quotation:create" },
  { label: "Add Employee",       icon: UserRound,    permCode: "hrm:employee:create" },
  { label: "Log Trip",           icon: Route,        permCode: "fleet:trip:create" },
  { label: "Add Vehicle",        icon: Truck,        permCode: "fleet:vehicle:create" },
  { label: "New Work Order",     icon: Wrench,       permCode: "rm:workorder:create" },
  { label: "Register Asset",     icon: Package,      permCode: "rm:asset:create" },
];

type QuickActionsProps = {
  items: QuickActionItem[];
};

export function QuickActions({ items }: QuickActionsProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No quick actions available — contact your administrator to request permissions.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <button
          key={item.permCode}
          type="button"
          aria-label={item.label}
          className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer"
        >
          <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm leading-tight">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
