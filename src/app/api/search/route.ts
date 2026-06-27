import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { getActionUser } from "@/lib/auth/get-action-user";
import { contacts } from "@/lib/db/schema/contacts";
import { items } from "@/lib/db/schema/inventory";
import { bills } from "@/lib/db/schema/bills";
import { invoices } from "@/lib/db/schema/invoices";
import { purchaseOrders } from "@/lib/db/schema/procurement";
import { leads } from "@/lib/db/schema/crm";
import { employees } from "@/lib/db/schema/hrm";
import { vehicles } from "@/lib/db/schema/fleet";

export type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export async function GET(req: NextRequest) {
  const user = await getActionUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 100) {
    return NextResponse.json({ results: [] });
  }

  const tid = user.tenant_id;
  const pat = `%${q}%`;
  const results: SearchResult[] = [];

  const [
    contactRows,
    itemRows,
    leadRows,
    billRows,
    invoiceRows,
    poRows,
    employeeRows,
    vehicleRows,
  ] = await Promise.all([
    db
      .select({ id: contacts.id, name: contacts.name, code: contacts.code, type: contacts.type })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tid), or(ilike(contacts.name, pat), ilike(contacts.code, pat))))
      .limit(5),

    db
      .select({ id: items.id, sku: items.sku, name: items.name })
      .from(items)
      .where(and(eq(items.tenantId, tid), or(ilike(items.sku, pat), ilike(items.name, pat))))
      .limit(5),

    db
      .select({ id: leads.id, name: leads.name, company: leads.company })
      .from(leads)
      .where(and(eq(leads.tenantId, tid), or(ilike(leads.name, pat), ilike(leads.company, pat))))
      .limit(5),

    db
      .select({ id: bills.id, billNo: bills.billNo })
      .from(bills)
      .where(and(eq(bills.tenantId, tid), ilike(bills.billNo, pat)))
      .limit(5),

    db
      .select({ id: invoices.id, invoiceNo: invoices.invoiceNo })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tid), ilike(invoices.invoiceNo, pat)))
      .limit(5),

    db
      .select({ id: purchaseOrders.id, poNo: purchaseOrders.poNo })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.tenantId, tid), ilike(purchaseOrders.poNo, pat)))
      .limit(5),

    db
      .select({ id: employees.id, empCode: employees.empCode, fullName: employees.fullName })
      .from(employees)
      .where(and(eq(employees.tenantId, tid), or(ilike(employees.fullName, pat), ilike(employees.empCode, pat))))
      .limit(5),

    db
      .select({ id: vehicles.id, regNumber: vehicles.regNumber, make: vehicles.make, model: vehicles.model })
      .from(vehicles)
      .where(and(eq(vehicles.tenantId, tid), or(ilike(vehicles.regNumber, pat), ilike(vehicles.make, pat), ilike(vehicles.model, pat))))
      .limit(5),
  ]);

  for (const r of invoiceRows) {
    results.push({
      type: "Invoice",
      id: r.id,
      title: r.invoiceNo,
      subtitle: null,
      href: `/app/accounts/invoices/${r.id}`,
    });
  }
  for (const r of billRows) {
    results.push({
      type: "Bill",
      id: r.id,
      title: r.billNo,
      subtitle: null,
      href: `/app/accounts/bills/${r.id}`,
    });
  }
  for (const r of contactRows) {
    results.push({
      type: "Contact",
      id: r.id,
      title: r.name,
      subtitle: r.code ?? r.type,
      href: `/app/accounts/contacts`,
    });
  }
  for (const r of vehicleRows) {
    results.push({
      type: "Vehicle",
      id: r.id,
      title: r.regNumber,
      subtitle: [r.make, r.model].filter(Boolean).join(" ") || null,
      href: `/app/fleet/vehicles/${r.id}`,
    });
  }
  for (const r of employeeRows) {
    results.push({
      type: "Employee",
      id: r.id,
      title: r.fullName,
      subtitle: r.empCode,
      href: `/app/hrm/employees`,
    });
  }
  for (const r of leadRows) {
    results.push({
      type: "Lead",
      id: r.id,
      title: r.name,
      subtitle: r.company ?? null,
      href: `/app/crm/leads`,
    });
  }
  for (const r of itemRows) {
    results.push({
      type: "Item",
      id: r.id,
      title: r.name,
      subtitle: r.sku,
      href: `/app/inventory/items`,
    });
  }
  for (const r of poRows) {
    results.push({
      type: "Purchase Order",
      id: r.id,
      title: r.poNo,
      subtitle: null,
      href: `/app/procurement/purchase-orders`,
    });
  }

  return NextResponse.json({ results });
}
