"use client";

import { useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitMerge, Plus, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStageAction, updateStageAction } from "@/server/actions/crm/pipeline";

type Stage = {
  id: string;
  name: string;
  sortOrder: number | null;
  winProbability: number | null;
};

type State = { success: true } | { success: false; error: string } | null;

function StageDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Stage | null;
}) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<State, FormData>(createStageAction, null);
  const [updateState, updateAction, updatePending] = useActionState<State, FormData>(updateStageAction, null);
  const state = editing ? updateState : createState;
  const action = editing ? updateAction : createAction;
  const pending = editing ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editing ? "Stage updated." : "Stage created.");
    }
  }, [state, editing, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Stage" : "New Stage"}</DialogTitle>
        </DialogHeader>
        <form id="stage-form" action={action} className="space-y-4 pt-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="st-name">Name</Label>
            <Input id="st-name" name="name" required defaultValue={editing?.name ?? ""} placeholder="Qualification" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="st-sort">Sort Order</Label>
              <Input id="st-sort" name="sortOrder" type="number" min="0" defaultValue={editing?.sortOrder ?? 0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-prob">Win % Probability</Label>
              <Input id="st-prob" name="winProbability" type="number" min="0" max="100" defaultValue={editing?.winProbability ?? 0} />
            </div>
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="stage-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = { stages: Stage[] };

export function PipelineSettings({ stages }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Stage | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(stage: Stage) {
    setEditing(stage);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4 mr-1" /> New Stage
        </Button>
      </div>

      {stages.length === 0 ? (
        <EmptyState icon={GitMerge} title="No stages" description="Add your first pipeline stage." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Stage Name</TableHead>
              <TableHead>Win Probability</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.sortOrder ?? 0}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.winProbability ?? 0}%</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <StageDialog key={dialogKey} open={open} onOpenChange={setOpen} editing={editing} />
    </>
  );
}
