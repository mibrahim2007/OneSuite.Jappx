import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyAccessToken } from "@/lib/auth/jwt";

export default async function AccountsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts");
  }

  const perms = user.permissions;

  if (perms.includes("accounts:coa:view")) {
    redirect("/app/accounts/chart-of-accounts");
  }
  if (perms.includes("accounts:journal:view")) {
    redirect("/app/accounts/journal-entries");
  }
  if (perms.includes("accounts:invoice:view")) {
    redirect("/app/accounts/invoices");
  }
  if (perms.includes("accounts:bill:view")) {
    redirect("/app/accounts/bills");
  }
  if (perms.includes("accounts:period:view")) {
    redirect("/app/accounts/fiscal-periods");
  }
  if (perms.includes("accounts:contact:view")) {
    redirect("/app/accounts/contacts");
  }

  redirect("/app/dashboard");
}
