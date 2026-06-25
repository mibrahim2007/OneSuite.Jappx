"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const MODULE_NAMES: Record<string, string> = {
  accounts: "Accounts",
  scm: "Supply Chain Management",
  crm: "CRM",
  hrm: "HR Management",
  fleet: "Fleet Management",
  rm: "Maintenance",
};

export function ModuleBlockedToast({ module }: { module: string | null }) {
  useEffect(() => {
    if (!module) return;
    const name = MODULE_NAMES[module] ?? module;
    toast.warning(`Your plan does not include ${name}`, {
      description: "Contact your administrator to upgrade your subscription.",
    });
  }, [module]);

  return null;
}
