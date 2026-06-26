"use client";

import { useState, useTransition, useActionState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Send, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { saveCampaignAction, launchCampaignAction, deleteCampaignAction } from "@/server/actions/crm/campaigns";

type CampaignRow = {
  id: string; name: string; description: string | null; type: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  subject: string | null; recipientCount: number | null;
  openCount: number | null; scheduledAt: Date | null; sentAt: Date | null;
  createdAt: Date;
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-800",
  sending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "lost"];

export function CampaignsView({ campaigns, canManage }: { campaigns: CampaignRow[]; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [pendingLaunch, setPendingLaunch] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const [formState, formAction, isPending] = useActionState(saveCampaignAction, null);

  if (formState?.success && open) setOpen(false);

  function openCreate() { setEditing(null); setDialogKey((k) => k + 1); setOpen(true); }
  function openEdit(c: CampaignRow) { setEditing(c); setDialogKey((k) => k + 1); setOpen(true); }

  function handleLaunch(id: string) {
    setPendingLaunch((p) => new Set(p).add(id));
    startTransition(async () => {
      try {
        const res = await launchCampaignAction(id);
        if (!res.success) toast.error(res.error ?? "Failed to launch.");
        else toast.success(`Campaign sent to ${res.sentCount} recipients.`);
      } catch { toast.error("Unexpected error."); }
      finally {
        setPendingLaunch((p) => { const n = new Set(p); n.delete(id); return n; });
      }
    });
  }

  function handleDelete(id: string) {
    setPendingDelete((p) => new Set(p).add(id));
    startTransition(async () => {
      try {
        const res = await deleteCampaignAction(id);
        if (!res.success) toast.error(res.error ?? "Failed to delete.");
        else toast.success("Campaign deleted.");
      } catch { toast.error("Unexpected error."); }
      finally {
        setPendingDelete((p) => { const n = new Set(p); n.delete(id); return n; });
      }
    });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> New Campaign
          </Button>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p>No campaigns yet. Create one to reach your leads.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Opens</TableHead>
              <TableHead>Sent At</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 capitalize text-sm">
                    <Mail className="h-3 w-3" /> {c.type}
                  </span>
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm">{c.subject ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-700"}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 text-sm">
                    <Users className="h-3 w-3" /> {c.recipientCount ?? 0}
                  </span>
                </TableCell>
                <TableCell>{c.openCount ?? 0}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.sentAt ? new Date(c.sentAt).toLocaleDateString() : "—"}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.status === "draft" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            disabled={pendingLaunch.has(c.id)}
                            onClick={() => handleLaunch(c.id)}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            disabled={pendingDelete.has(c.id)}
                            onClick={() => handleDelete(c.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent key={dialogKey} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input name="name" defaultValue={editing?.name ?? ""} required />
              </div>
              <div>
                <Label>Type</Label>
                <select name="type" className={SELECT_CLASS} defaultValue={editing?.type ?? "email"}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Subject</Label>
              <Input name="subject" defaultValue={editing?.subject ?? ""} placeholder="Email subject line" />
            </div>
            <div>
              <Label>Message Body</Label>
              <Textarea name="bodyHtml" rows={5} defaultValue={editing ? "" : ""} placeholder="Campaign message content..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Lead Status</Label>
                <select name="targetLeadStatus" className={SELECT_CLASS} defaultValue="">
                  <option value="">All leads with email</option>
                  {LEAD_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
              <div>
                <Label>Scheduled At</Label>
                <Input name="scheduledAt" type="datetime-local" defaultValue="" />
              </div>
            </div>
            {formState && !formState.success && (
              <p className="text-sm text-destructive">{formState.error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save Draft"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
