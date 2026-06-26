"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/utils/export-csv";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  createContactAction,
  updateContactAction,
  toggleContactActiveAction,
} from "@/server/actions/contacts";
import { contactSchema, CONTACT_TYPES, CONTACT_TYPE_LABELS } from "@/lib/validations/contacts";
import type { Contact } from "@/lib/db/schema";
import type { ContactType } from "@/lib/validations/contacts";

type ContactsViewProps = {
  contacts: Contact[];
  canManage: boolean;
};

function getTypeBadgeVariant(
  type: string
): "outline" | "secondary" | "default" {
  if (type === "vendor") return "outline";
  if (type === "customer") return "secondary";
  return "default";
}

const BLANK_FORM = {
  type: "vendor" as ContactType,
  name: "",
  code: "",
  email: "",
  phone: "",
  address: "",
  paymentTermsDays: "",
};

export function ContactsView({ contacts, canManage }: ContactsViewProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [, startToggleTransition] = useTransition();

  const [formType, setFormType] = useState<ContactType>("vendor");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPaymentTerms, setFormPaymentTerms] = useState("");

  function openCreate() {
    setEditingContact(null);
    setFormType(BLANK_FORM.type);
    setFormName(BLANK_FORM.name);
    setFormCode(BLANK_FORM.code);
    setFormEmail(BLANK_FORM.email);
    setFormPhone(BLANK_FORM.phone);
    setFormAddress(BLANK_FORM.address);
    setFormPaymentTerms(BLANK_FORM.paymentTermsDays);
    setDialogOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditingContact(contact);
    setFormType((contact.type as ContactType) ?? "vendor");
    setFormName(contact.name);
    setFormCode(contact.code ?? "");
    setFormEmail(contact.email ?? "");
    setFormPhone(contact.phone ?? "");
    setFormAddress(contact.address ?? "");
    setFormPaymentTerms(contact.paymentTermsDays != null ? String(contact.paymentTermsDays) : "");
    setDialogOpen(true);
  }

  function handleSubmit() {
    const rawData = {
      type: formType,
      name: formName.trim(),
      code: formCode.trim() || undefined,
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      address: formAddress.trim() || undefined,
      paymentTermsDays: formPaymentTerms.trim() ? Number(formPaymentTerms.trim()) : undefined,
    };

    startSubmitTransition(async () => {
      try {
        const parsed = contactSchema.safeParse(rawData);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Invalid input.");
          return;
        }
        const result = editingContact
          ? await updateContactAction(editingContact.id, parsed.data)
          : await createContactAction(parsed.data);
        if (result.success) {
          setDialogOpen(false);
          router.refresh();
          toast.success(editingContact ? "Contact updated." : "Contact created.");
        } else {
          toast.error(result.error ?? "Failed to save contact.");
        }
      } catch {
        toast.error("Failed to save contact.");
      }
    });
  }

  function handleToggleActive(contact: Contact) {
    setPendingIds((prev) => new Set(prev).add(contact.id));
    startToggleTransition(async () => {
      try {
        const result = await toggleContactActiveAction(contact.id, !contact.isActive);
        if (result.success) {
          router.refresh();
          toast.success(contact.isActive ? "Contact deactivated." : "Contact activated.");
        } else {
          toast.error(result.error ?? "Failed to update contact.");
        }
      } catch {
        toast.error("Failed to update contact.");
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(contact.id);
          return next;
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          {contacts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCsv("contacts", contacts as unknown as Record<string, unknown>[], [
                  { key: "code", label: "Code" },
                  { key: "name", label: "Name" },
                  { key: "type", label: "Type" },
                  { key: "email", label: "Email" },
                  { key: "phone", label: "Phone" },
                  { key: "paymentTermsDays", label: "Payment Terms (days)" },
                  { key: "isActive", label: "Active" },
                ])
              }
            >
              Export CSV
            </Button>
          )}
          {canManage && (
            <Button size="sm" onClick={openCreate}>
              New Contact
            </Button>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Edit Contact" : "New Contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact-type">Type *</Label>
                <select
                  id="contact-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as ContactType)}
                  className={SELECT_CLASS}
                >
                  {CONTACT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CONTACT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-code">Code</Label>
                <Input
                  id="contact-code"
                  placeholder="e.g. SUPP-001"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name *</Label>
              <Input
                id="contact-name"
                placeholder="Full name or company name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="contact@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  placeholder="+1 555 000 0000"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact-address">Address</Label>
                <Input
                  id="contact-address"
                  placeholder="Street, City, Country"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-terms">Payment Terms (days)</Label>
                <Input
                  id="contact-terms"
                  type="number"
                  min={0}
                  max={365}
                  placeholder="30"
                  value={formPaymentTerms}
                  onChange={(e) => setFormPaymentTerms(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add vendors and customers to use them in bills and invoices."
          action={
            canManage ? (
              <Button size="sm" onClick={openCreate}>
                Add First Contact
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="text-muted-foreground text-sm font-mono">
                  {contact.code ?? "—"}
                </TableCell>
                <TableCell className="font-medium">{contact.name}</TableCell>
                <TableCell>
                  <Badge variant={getTypeBadgeVariant(contact.type)}>
                    {CONTACT_TYPE_LABELS[contact.type as ContactType] ?? contact.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{contact.email ?? "—"}</TableCell>
                <TableCell className="text-sm">{contact.phone ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {contact.paymentTermsDays != null
                    ? `${contact.paymentTermsDays} days`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={contact.isActive ? "outline" : "destructive"}>
                    {contact.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(contact)}
                        disabled={pendingIds.has(contact.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pendingIds.has(contact.id)}
                        onClick={() => handleToggleActive(contact)}
                      >
                        {pendingIds.has(contact.id)
                          ? "…"
                          : contact.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
