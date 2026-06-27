import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { tickets, crmCompanies, crmContacts, users, memberships } from "@/lib/db/schema";
import { TicketDetailView } from "@/components/app/crm/ticket-detail-view";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect(`/api/auth/refresh?next=/app/crm/tickets/${id}`);
  }

  const permError = requirePermission("crm:lead:view", user);
  if (permError) redirect("/app/dashboard");

  const assignee = alias(users, "assignee");

  const [row, companyRows, contactRows] = await Promise.all([
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
      .where(and(eq(tickets.id, id), eq(tickets.tenantId, user.tenant_id)))
      .limit(1),

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

  const ticket = row[0];
  if (!ticket) notFound();

  const memberRows = await db
    .select({ userId: memberships.userId, fullName: users.fullName })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.tenantId, user.tenant_id));

  const userList = memberRows.map((m) => ({ id: m.userId, fullName: m.fullName }));

  return (
    <TicketDetailView
      ticket={ticket}
      companies={companyRows}
      contacts={contactRows}
      users={userList}
    />
  );
}
