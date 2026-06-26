import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { drivers } from "@/lib/db/schema";
import { DriversTable } from "@/components/app/fleet/drivers-table";

export default async function DriversPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/drivers");
  }

  const permError = requirePermission("fleet:driver:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select({
      id: drivers.id,
      name: drivers.name,
      licenseNo: drivers.licenseNo,
      licenseExpiry: drivers.licenseExpiry,
      phone: drivers.phone,
      isActive: drivers.isActive,
    })
    .from(drivers)
    .where(eq(drivers.tenantId, user.tenant_id))
    .orderBy(asc(drivers.name));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Drivers</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage drivers and their license compliance.</p>
      <div className="mt-6">
        <DriversTable
          drivers={rows}
          canCreate={user.permissions.includes("fleet:driver:create")}
          canEdit={user.permissions.includes("fleet:driver:update")}
        />
      </div>
    </div>
  );
}
