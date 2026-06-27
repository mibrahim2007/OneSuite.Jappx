import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { tickets, crmCompanies, crmContacts, users, memberships } from "@/lib/db/schema";
import { TicketsTable } from "@/components/app/crm/tickets-table";

export const metadata = { title: "Support Tickets — OneSuite" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/tickets");
  }

  const permError = requirePermission("crm:lead:view", user);
  if (permError) redirect("/app/dashboard");

  const params = await searchParams;
  const statusFilter = params.status;
  const priorityFilter = params.priority;

  const assignee = alias(users, "assignee");

  const conditions = [eq(tickets.tenantId, user.tenant_id)];
  if (statusFilter && statusFilter !== "all") {
    conditions.push(
      eq(tickets.status, statusFilter as "open" | "pending" | "resolved" | "closed")
    );
  }
  if (priorityFilter && priorityFilter !== "all") {
    conditions.push(
      eq(tickets.priority, priorityFilter as "low" | "medium" | "high" | "urgent")
    );
  }

  const [ticketRows, companyRows, contactRows] = await Promise.all([
    db
      .select({
        id: tickets.id,
        ticketNo: tickets.ticketNo,
        subject: tickets.subject,
        description: tickets.description,
        companyId: tickets.companyId,
        contactId: tickets.contactId,
        priority: tickets.priority,
        status: tickets.status,
        assignedTo: tickets.assignedTo,
        dueAt: tickets.dueAt,
        resolvedAt: tickets.resolvedAt,
        createdAt: tickets.createdAt,
        companyName: crmCompanies.name,
        contactName: crmContacts.fullName,
        assigneeName: assignee.fullName,
      })
      .from(tickets)
      .leftJoin(crmCompanies, eq(tickets.companyId, crmCompanies.id))
      .leftJoin(crmContacts, eq(tickets.contactId, crmContacts.id))
      .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
      .where(and(...conditions))
      .orderBy(desc(tickets.createdAt)),

    db
      .select({ id: crmCompanies.id, name: crmCompanies.name })
      .from(crmCompanies)
      .where(eq(crmCompanies.tenantId, user.tenant_id))
      .orderBy(asc(crmCompanies.name)),

    db
      .select({ id: crmContacts.id, fullName: crmContacts.fullName, companyId: crmContacts.companyId })
      .from(crmContacts)
      .where(eq(crmContacts.tenantId, user.tenant_id))
      .orderBy(asc(crmContacts.fullName)),
  ]);

  const memberRows = await db
    .select({ userId: memberships.userId, fullName: users.fullName })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.tenantId, user.tenant_id));

  const userList = memberRows.map((m) => ({ id: m.userId, fullName: m.fullName }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Support Tickets</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Track and resolve customer support requests with SLA deadlines.
      </p>
      <div className="mt-6">
        <TicketsTable
          tickets={ticketRows}
          companies={companyRows}
          contacts={contactRows}
          users={userList}
        />
      </div>
    </div>
  );
}
