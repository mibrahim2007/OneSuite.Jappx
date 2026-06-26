"use client";

import { useState, useTransition, useActionState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, PowerOff, CreditCard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { savePlanAction, togglePlanAction, saveSubscriptionAction } from "@/server/actions/admin/billing";

type Plan = {
  id: string; name: string; code: string; priceMonthly: string;
  maxUsers: number | null; modules: string[]; isActive: boolean;
};
type SubRow = {
  id: string; tenantId: string; tenantName: string; planId: string; planName: string;
  status: string; seats: number; trialEndsAt: Date | null;
  currentPeriodEnd: Date | null; createdAt: Date;
};
type Tenant = { id: string; name: string };

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-blue-100 text-blue-800",
  past_due: "bg-yellow-100 text-yellow-800",
  canceled: "bg-gray-100 text-gray-600",
  expired: "bg-red-100 text-red-800",
};

export function BillingDashboard({ plans, subscriptions, tenants }: {
  plans: Plan[]; subscriptions: SubRow[]; tenants: Tenant[];
}) {
  const [planOpen, setPlanOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editingSub, setEditingSub] = useState<SubRow | null>(null);
  const [planKey, setPlanKey] = useState(0);
  const [subKey, setSubKey] = useState(0);
  const [pendingToggle, setPendingToggle] = useState<Set<string>>(new Set());
  const [, startToggle] = useTransition();

  const [planState, planAction, planPending] = useActionState(savePlanAction, null);
  const [subState, subAction, subPending] = useActionState(saveSubscriptionAction, null);

  if (planState?.success && planOpen) setPlanOpen(false);
  if (subState?.success && subOpen) setSubOpen(false);

  function openCreatePlan() { setEditingPlan(null); setPlanKey((k) => k + 1); setPlanOpen(true); }
  function openEditPlan(p: Plan) { setEditingPlan(p); setPlanKey((k) => k + 1); setPlanOpen(true); }
  function openCreateSub() { setEditingSub(null); setSubKey((k) => k + 1); setSubOpen(true); }
  function openEditSub(s: SubRow) { setEditingSub(s); setSubKey((k) => k + 1); setSubOpen(true); }

  function handleTogglePlan(id: string, current: boolean) {
    setPendingToggle((p) => new Set(p).add(id));
    startToggle(async () => {
      try {
        const res = await togglePlanAction(id, !current);
        if (!res.success) toast.error(res.error ?? "Failed.");
      } catch { toast.error("Unexpected error."); }
      finally {
        setPendingToggle((p) => { const n = new Set(p); n.delete(id); return n; });
      }
    });
  }

  return (
    <Tabs defaultValue="plans">
      <TabsList>
        <TabsTrigger value="plans">Plans</TabsTrigger>
        <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
      </TabsList>

      <TabsContent value="plans" className="space-y-4 mt-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreatePlan}><Plus className="mr-1 h-4 w-4" /> New Plan</Button>
        </div>
        {plans.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p>No plans defined.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Price / month</TableHead>
                <TableHead>Max Users</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell>PKR {parseFloat(p.priceMonthly).toLocaleString()}</TableCell>
                  <TableCell>{p.maxUsers ?? "Unlimited"}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{p.modules.join(", ") || "All"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={p.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditPlan(p)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" disabled={pendingToggle.has(p.id)} onClick={() => handleTogglePlan(p.id, p.isActive)}>
                        {p.isActive ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="subscriptions" className="space-y-4 mt-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreateSub}><Plus className="mr-1 h-4 w-4" /> Assign Subscription</Button>
        </div>
        {subscriptions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p>No subscriptions yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Trial Ends</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.tenantName}</TableCell>
                  <TableCell>{s.planName}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE[s.status] ?? "bg-gray-100 text-gray-700"}>
                      {s.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.seats}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openEditSub(s)}><Pencil className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      {/* Plan Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent key={planKey}>
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "New Plan"}</DialogTitle>
          </DialogHeader>
          <form action={planAction} className="space-y-4">
            {editingPlan && <input type="hidden" name="id" value={editingPlan.id} />}
            <div><Label>Name *</Label>
              <Input name="name" defaultValue={editingPlan?.name ?? ""} required /></div>
            <div><Label>Code *</Label>
              <Input name="code" defaultValue={editingPlan?.code ?? ""} placeholder="basic, pro, enterprise" required /></div>
            <div><Label>Monthly Price (PKR) *</Label>
              <Input name="priceMonthly" type="number" min="0" step="0.01" defaultValue={editingPlan?.priceMonthly ?? "0"} required /></div>
            <div><Label>Max Users</Label>
              <Input name="maxUsers" type="number" min="1" defaultValue={editingPlan?.maxUsers ?? ""} placeholder="Leave blank for unlimited" /></div>
            <div><Label>Modules (comma-separated)</Label>
              <Input name="modules" defaultValue={editingPlan?.modules.join(", ") ?? ""} placeholder="accounts,fleet,hrm,crm" /></div>
            {planState && !planState.success && <p className="text-sm text-destructive">{planState.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={planPending}>{planPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subscription Dialog */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent key={subKey}>
          <DialogHeader>
            <DialogTitle>{editingSub ? "Edit Subscription" : "Assign Subscription"}</DialogTitle>
          </DialogHeader>
          <form action={subAction} className="space-y-4">
            {editingSub && <input type="hidden" name="id" value={editingSub.id} />}
            <div><Label>Tenant *</Label>
              <select name="tenantId" className={SELECT_CLASS} defaultValue={editingSub?.tenantId ?? ""} required>
                <option value="">— Select tenant —</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div><Label>Plan *</Label>
              <select name="planId" className={SELECT_CLASS} defaultValue={editingSub?.planId ?? ""} required>
                <option value="">— Select plan —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label>Status</Label>
              <select name="status" className={SELECT_CLASS} defaultValue={editingSub?.status ?? "trialing"}>
                {["trialing", "active", "past_due", "canceled", "expired"].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div><Label>Seats</Label>
              <Input name="seats" type="number" min="1" defaultValue={editingSub?.seats ?? 1} /></div>
            <div><Label>Trial Ends At</Label>
              <Input name="trialEndsAt" type="date" defaultValue={editingSub?.trialEndsAt ? new Date(editingSub.trialEndsAt).toISOString().split("T")[0] : ""} /></div>
            <div><Label>Period End</Label>
              <Input name="currentPeriodEnd" type="date" defaultValue={editingSub?.currentPeriodEnd ? new Date(editingSub.currentPeriodEnd).toISOString().split("T")[0] : ""} /></div>
            {subState && !subState.success && <p className="text-sm text-destructive">{subState.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={subPending}>{subPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
