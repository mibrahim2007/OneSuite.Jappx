"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitMerge, Plus, Pencil, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/lib/ui-constants";
import {
  createStageAction,
  updateStageAction,
  createOpportunityAction,
  updateOpportunityAction,
  closeOpportunityAction,
} from "@/server/actions/crm/pipeline";

type Stage = {
  id: string;
  name: string;
  sortOrder: number | null;
  winProbability: number | null;
};

type Opp = {
  id: string;
  title: string;
  stageId: string | null;
  companyId: string | null;
  contactId: string | null;
  amount: string | null;
  currency: string | null;
  expectedClose: string | null;
  isWon: boolean | null;
  closedAt: Date | null;
  companyName: string | null;
  contactName: string | null;
};

type CompanyOption = { id: string; name: string };
type ContactOption = { id: string; fullName: string };

type State = { success: true } | { success: false; error: string } | null;

function OppDialog({
  open,
  onOpenChange,
  editing,
  stages,
  companies,
  contacts,
  defaultStageId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Opp | null;
  stages: Stage[];
  companies: CompanyOption[];
  contacts: ContactOption[];
  defaultStageId?: string;
}) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<State, FormData>(createOpportunityAction, null);
  const [updateState, updateAction, updatePending] = useActionState<State, FormData>(updateOpportunityAction, null);
  const state = editing ? updateState : createState;
  const action = editing ? updateAction : createAction;
  const pending = editing ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editing ? "Opportunity updated." : "Opportunity created.");
    }
  }, [state, editing, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Opportunity" : "New Opportunity"}</DialogTitle>
        </DialogHeader>
        <form id="opp-form" action={action} className="space-y-4 pt-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="opp-title">Title</Label>
            <Input id="opp-title" name="title" required defaultValue={editing?.title ?? ""} placeholder="Deal name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opp-stage">Stage</Label>
            <select name="stageId" id="opp-stage" className={`w-full ${SELECT_CLASS}`} defaultValue={editing?.stageId ?? defaultStageId ?? ""}>
              <option value="">— None —</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opp-company">Company</Label>
            <select name="companyId" id="opp-company" className={`w-full ${SELECT_CLASS}`} defaultValue={editing?.companyId ?? ""}>
              <option value="">— None —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opp-contact">Contact</Label>
            <select name="contactId" id="opp-contact" className={`w-full ${SELECT_CLASS}`} defaultValue={editing?.contactId ?? ""}>
              <option value="">— None —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="opp-amount">Amount</Label>
              <Input id="opp-amount" name="amount" type="number" step="0.01" min="0" defaultValue={editing?.amount ?? ""} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-close">Expected Close</Label>
              <Input id="opp-close" name="expectedClose" type="date" defaultValue={editing?.expectedClose ?? ""} />
            </div>
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="opp-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  stages: Stage[];
  opportunities: Opp[];
  companies: CompanyOption[];
  contacts: ContactOption[];
  canCreate: boolean;
  canEdit: boolean;
};

export function PipelineView({ stages, opportunities, companies, contacts, canCreate, canEdit }: Props) {
  const router = useRouter();
  const [oppOpen, setOppOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opp | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [dialogKey, setDialogKey] = useState(0);
  const [closing, startClose] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function openCreateOpp(stageId?: string) {
    setEditingOpp(null);
    setDefaultStageId(stageId);
    setDialogKey((k) => k + 1);
    setOppOpen(true);
  }

  function openEditOpp(opp: Opp) {
    setEditingOpp(opp);
    setDefaultStageId(undefined);
    setDialogKey((k) => k + 1);
    setOppOpen(true);
  }

  function handleClose(opp: Opp, isWon: boolean) {
    setPendingId(opp.id);
    startClose(async () => {
      const res = await closeOpportunityAction(opp.id, isWon);
      if (res.success) { toast.success(isWon ? "Marked as won." : "Marked as lost."); router.refresh(); }
      else toast.error(res.error);
      setPendingId(null);
    });
  }

  const openOpps = opportunities.filter((o) => o.isWon === null && !o.closedAt);
  const stageMap = new Map(stages.map((s) => [s.id, s]));

  if (stages.length === 0) {
    return (
      <EmptyState
        icon={GitMerge}
        title="No pipeline stages"
        description="Create pipeline stages in Settings to track opportunities."
      />
    );
  }

  return (
    <div className="space-y-6">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openCreateOpp()}>
            <Plus className="size-4 mr-1" /> New Opportunity
          </Button>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(200px, 1fr))` }}>
        {stages.map((stage) => {
          const stageOpps = openOpps.filter((o) => o.stageId === stage.id);
          const total = stageOpps.reduce((sum, o) => sum + parseFloat(o.amount ?? "0"), 0);

          return (
            <div key={stage.id} className="bg-muted/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{stage.name}</span>
                <span className="text-xs text-muted-foreground">{stageOpps.length}</span>
              </div>
              {total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              )}

              {stageOpps.map((opp) => (
                <div key={opp.id} className="bg-background border rounded-md p-2.5 space-y-1">
                  <p className="text-sm font-medium leading-tight">{opp.title}</p>
                  {opp.companyName && <p className="text-xs text-muted-foreground">{opp.companyName}</p>}
                  {opp.amount && parseFloat(opp.amount) > 0 && (
                    <p className="text-xs font-semibold">{parseFloat(opp.amount).toLocaleString()} {opp.currency}</p>
                  )}
                  {opp.expectedClose && (
                    <p className="text-xs text-muted-foreground">Close: {opp.expectedClose}</p>
                  )}
                  {(canEdit) && (
                    <div className="flex gap-1 pt-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditOpp(opp)}>
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-green-600"
                        disabled={pendingId === opp.id}
                        onClick={() => handleClose(opp, true)}
                        title="Mark as Won"
                      >
                        <Trophy className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        disabled={pendingId === opp.id}
                        onClick={() => handleClose(opp, false)}
                        title="Mark as Lost"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {canCreate && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => openCreateOpp(stage.id)}>
                  <Plus className="size-3 mr-1" /> Add
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Closed opportunities */}
      {opportunities.filter((o) => o.closedAt !== null).length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Closed</h3>
          <div className="space-y-1">
            {opportunities
              .filter((o) => o.closedAt !== null)
              .map((opp) => (
                <div key={opp.id} className="flex items-center gap-3 text-sm p-2 border rounded">
                  <Badge variant={opp.isWon ? "default" : "secondary"}>{opp.isWon ? "Won" : "Lost"}</Badge>
                  <span className="font-medium">{opp.title}</span>
                  {opp.companyName && <span className="text-muted-foreground">{opp.companyName}</span>}
                  {opp.stageId && stageMap.get(opp.stageId) && (
                    <span className="text-muted-foreground">{stageMap.get(opp.stageId)!.name}</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      <OppDialog
        key={dialogKey}
        open={oppOpen}
        onOpenChange={setOppOpen}
        editing={editingOpp}
        stages={stages}
        companies={companies}
        contacts={contacts}
        defaultStageId={defaultStageId}
      />
    </div>
  );
}
