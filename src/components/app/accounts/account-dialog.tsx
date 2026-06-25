"use client";

import {
  useActionState,
  useEffect,
  startTransition,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAccountAction, updateAccountAction } from "@/server/actions/accounts";
import {
  accountFormSchema,
  updateAccountSchema,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type AccountFormValues,
  type UpdateAccountFormValues,
} from "@/lib/validations/accounts";
import { SELECT_CLASS } from "@/lib/ui-constants";
import type { Account, AccountGroup } from "@/lib/db/schema";

type AccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAccount: Account | null;
  groups: AccountGroup[];
};

type CreateFormProps = {
  groups: AccountGroup[];
  formAction: (formData: FormData) => void;
};

type EditFormProps = {
  account: Account;
  groups: AccountGroup[];
  formAction: (formData: FormData) => void;
};

function CreateAccountForm({ groups, formAction }: CreateFormProps) {
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { code: "", name: "", type: "asset", groupId: "", currency: "" },
  });

  function onSubmit(values: AccountFormValues) {
    const fd = new FormData();
    fd.append("code", values.code);
    fd.append("name", values.name);
    fd.append("type", values.type);
    fd.append("groupId", values.groupId ?? "");
    fd.append("currency", values.currency ?? "");
    startTransition(() => formAction(fd));
  }

  return (
    <form id="account-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="account-code">Code</Label>
        <Input id="account-code" {...form.register("code")} placeholder="e.g. 1000" />
        {form.formState.errors.code && (
          <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-name">Name</Label>
        <Input id="account-name" {...form.register("name")} placeholder="e.g. Cash at Bank" />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-type">Type</Label>
        <select id="account-type" {...form.register("type")} className={SELECT_CLASS}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-group">Group</Label>
        <select id="account-group" {...form.register("groupId")} className={SELECT_CLASS}>
          <option value="">No group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-currency">Currency (optional)</Label>
        <Input id="account-currency" {...form.register("currency")} placeholder="e.g. USD" maxLength={3} />
        {form.formState.errors.currency && (
          <p className="text-xs text-destructive">{form.formState.errors.currency.message}</p>
        )}
      </div>
    </form>
  );
}

function EditAccountForm({ account, groups, formAction }: EditFormProps) {
  const form = useForm<UpdateAccountFormValues>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      id: account.id,
      name: account.name,
      type: account.type as UpdateAccountFormValues["type"],
      groupId: account.groupId ?? "",
      currency: account.currency ?? "",
    },
  });

  function onSubmit(values: UpdateAccountFormValues) {
    const fd = new FormData();
    fd.append("id", account.id);
    fd.append("name", values.name);
    fd.append("type", values.type);
    fd.append("groupId", values.groupId ?? "");
    fd.append("currency", values.currency ?? "");
    startTransition(() => formAction(fd));
  }

  return (
    <form id="account-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="account-code">Code</Label>
        <Input id="account-code" value={account.code} readOnly className="bg-muted" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-name">Name</Label>
        <Input id="account-name" {...form.register("name")} placeholder="e.g. Cash at Bank" />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-type">Type</Label>
        <select id="account-type" {...form.register("type")} className={SELECT_CLASS}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-group">Group</Label>
        <select id="account-group" {...form.register("groupId")} className={SELECT_CLASS}>
          <option value="">No group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-currency">Currency (optional)</Label>
        <Input id="account-currency" {...form.register("currency")} placeholder="e.g. USD" maxLength={3} />
        {form.formState.errors.currency && (
          <p className="text-xs text-destructive">{form.formState.errors.currency.message}</p>
        )}
      </div>
    </form>
  );
}

export function AccountDialog({
  open,
  onOpenChange,
  editingAccount,
  groups,
}: AccountDialogProps) {
  const router = useRouter();
  const [createState, createFormAction, createPending] = useActionState(
    createAccountAction,
    null
  );
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateAccountAction,
    null
  );

  const state = editingAccount ? updateState : createState;
  const formAction = editingAccount ? updateFormAction : createFormAction;
  const isPending = editingAccount ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editingAccount ? "Account updated." : "Account created.");
    }
  }, [state, editingAccount, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingAccount ? "Edit Account" : "New Account"}
          </DialogTitle>
        </DialogHeader>

        {editingAccount ? (
          <EditAccountForm
            key={editingAccount.id}
            account={editingAccount}
            groups={groups}
            formAction={formAction}
          />
        ) : (
          <CreateAccountForm
            key="new"
            groups={groups}
            formAction={formAction}
          />
        )}

        {state && !state.success && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <DialogFooter showCloseButton>
          <Button type="submit" form="account-form" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
