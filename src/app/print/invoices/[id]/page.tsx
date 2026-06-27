import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { invoices, invoiceLines, contacts, accounts, tenants } from "@/lib/db/schema";
import { PrintButton } from "./print-button";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/app/accounts/invoices");

  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect(`/api/auth/refresh?next=/print/invoices/${id}`);
  }

  const [invoiceRows, lineRows, tenantRows] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, user.tenant_id)))
      .limit(1),
    db
      .select()
      .from(invoiceLines)
      .where(and(eq(invoiceLines.invoiceId, id), eq(invoiceLines.tenantId, user.tenant_id)))
      .orderBy(asc(invoiceLines.sortOrder)),
    db
      .select({ name: tenants.name, legalName: tenants.legalName, logoUrl: tenants.logoUrl })
      .from(tenants)
      .where(eq(tenants.id, user.tenant_id))
      .limit(1),
  ]);

  const invoice = invoiceRows[0];
  if (!invoice) redirect("/app/accounts/invoices");

  const accountIds = [...new Set(lineRows.map((l) => l.accountId))];

  const [customerRows, accountRows] = await Promise.all([
    db
      .select({ name: contacts.name, email: contacts.email, phone: contacts.phone, address: contacts.address })
      .from(contacts)
      .where(eq(contacts.id, invoice.customerId))
      .limit(1),
    accountIds.length > 0
      ? db
          .select({ id: accounts.id, code: accounts.code, name: accounts.name })
          .from(accounts)
          .where(inArray(accounts.id, accountIds))
      : Promise.resolve([] as Array<{ id: string; code: string; name: string }>),
  ]);

  const customer = customerRows[0];
  const tenant = tenantRows[0];
  const accountMap = new Map(accountRows.map((a) => [a.id, `${a.code} – ${a.name}`]));

  const subtotal = parseFloat(invoice.subtotal);
  const taxAmount = parseFloat(invoice.taxAmount);
  const total = parseFloat(invoice.total);
  const currency = invoice.currencyCode;

  const statusStyle =
    invoice.status === "posted"
      ? { bg: "#dcfce7", color: "#166534" }
      : invoice.status === "cancelled"
        ? { bg: "#fee2e2", color: "#991b1b" }
        : { bg: "#f3f4f6", color: "#374151" };

  return (
    <>
      <style>{`
        @media print { .no-print { display: none !important; } body { background: white !important; } }
        @page { size: A4; margin: 20mm; }
      `}</style>

      {/* Screen-only toolbar */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background px-6 py-3">
        <span className="text-sm text-muted-foreground">
          Invoice preview — {invoice.invoiceNo}
        </span>
        <div className="flex gap-2">
          <a
            href={`/app/accounts/invoices/${id}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            ← Back
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Invoice body */}
      <div
        className="mx-auto max-w-[800px] bg-white px-12 py-10 text-sm text-gray-900"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            {tenant?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt="Logo" style={{ height: 48, objectFit: "contain", marginBottom: 8 }} />
            )}
            <p style={{ fontSize: 17, fontWeight: 700 }}>{tenant?.legalName ?? tenant?.name ?? "Company"}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "#1f2937" }}>INVOICE</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginTop: 2 }}>{invoice.invoiceNo}</p>
            <span
              style={{
                display: "inline-block",
                marginTop: 4,
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                background: statusStyle.bg,
                color: statusStyle.color,
              }}
            >
              {invoice.status}
            </span>
          </div>
        </div>

        {/* Bill To + Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#6b7280", marginBottom: 4 }}>Bill To</p>
            {customer ? (
              <>
                <p style={{ fontWeight: 600 }}>{customer.name}</p>
                {customer.address && <p style={{ color: "#4b5563", fontSize: 11, marginTop: 2 }}>{customer.address}</p>}
                {customer.email && <p style={{ color: "#4b5563", fontSize: 11 }}>{customer.email}</p>}
                {customer.phone && <p style={{ color: "#4b5563", fontSize: 11 }}>{customer.phone}</p>}
              </>
            ) : (
              <p style={{ color: "#9ca3af", fontSize: 11 }}>—</p>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            {[
              ["Invoice Date", invoice.invoiceDate],
              ["Due Date", invoice.dueDate],
              ...(invoice.reference ? [["Reference", invoice.reference]] : []),
              ["Currency", currency],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "flex-end", gap: 24, padding: "2px 0" }}>
                <span style={{ color: "#6b7280", fontSize: 11 }}>{label}</span>
                <span style={{ fontWeight: 500, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              {["Account", "Description", "Amount", "Tax", "Line Total"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: "6px 8px 6px 0",
                    textAlign: i >= 2 ? "right" : "left",
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    fontSize: 10,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineRows.map((line, i) => {
              const amt = parseFloat(line.amount);
              const tax = parseFloat(line.taxAmount);
              return (
                <tr key={line.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                  <td style={{ padding: "7px 8px 7px 0", color: "#4b5563" }}>
                    {accountMap.get(line.accountId) ?? line.accountId.slice(0, 8) + "…"}
                  </td>
                  <td style={{ padding: "7px 8px 7px 0", color: "#374151" }}>
                    {line.description ?? "—"}
                  </td>
                  <td style={{ padding: "7px 8px 7px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(amt)}
                  </td>
                  <td style={{ padding: "7px 8px 7px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: tax > 0 ? "#374151" : "#9ca3af" }}>
                    {tax > 0 ? fmt(tax) : "—"}
                  </td>
                  <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(amt + tax)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
          <div style={{ width: 240, borderTop: "1px solid #e5e7eb" }}>
            {[
              ["Subtotal", fmt(subtotal)],
              ["Tax", fmt(taxAmount)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 11 }}>
                <span style={{ color: "#6b7280" }}>{label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderTop: "2px solid #1f2937",
                marginTop: 2,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <span>Total ({currency})</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#6b7280", marginBottom: 4 }}>Notes</p>
            <p style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.5 }}>{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: "center", fontSize: 9, color: "#d1d5db" }}>
          Generated by OneSuite ERP · {new Date().toLocaleDateString("en-PK")}
        </div>
      </div>
    </>
  );
}
