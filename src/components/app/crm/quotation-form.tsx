"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/lib/ui-constants";
import type { Route } from "next";
import { createQuotationAction } from "@/server/actions/crm/quotations";

type CompanyOption = { id: string; name: string };
type OppOption = { id: string; title: string };
type ItemOption = { id: string; name: string; salePrice: string | null };

type Line = {
  itemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type Props = {
  companies: CompanyOption[];
  opportunities: OppOption[];
  items: ItemOption[];
};

export function QuotationForm({ companies, opportunities, items }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([
    { itemId: "", description: "", quantity: "1", unitPrice: "0" },
  ]);

  const today = new Date().toISOString().slice(0, 10);

  function addLine() {
    setLines((prev) => [...prev, { itemId: "", description: "", quantity: "1", unitPrice: "0" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function setLine(i: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  function onItemSelect(i: number, itemId: string) {
    const item = items.find((it) => it.id === itemId);
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? {
              ...l,
              itemId,
              description: item?.name ?? l.description,
              unitPrice: item?.salePrice ?? "0",
            }
          : l
      )
    );
  }

  const subtotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    // Append lines
    lines.forEach((l, i) => {
      fd.append(`lines[${i}][itemId]`, l.itemId);
      fd.append(`lines[${i}][description]`, l.description);
      fd.append(`lines[${i}][quantity]`, l.quantity);
      fd.append(`lines[${i}][unitPrice]`, l.unitPrice);
    });

    startTransition(async () => {
      const res = await createQuotationAction(null, fd);
      if (res?.success) {
        toast.success("Quotation created.");
        router.push(`/app/crm/quotations${res.id ? `/${res.id}` : ""}` as Route);
      } else if (res) {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="qt-company">Company</Label>
          <select name="companyId" id="qt-company" className={`w-full ${SELECT_CLASS}`}>
            <option value="">— None —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qt-opp">Opportunity</Label>
          <select name="opportunityId" id="qt-opp" className={`w-full ${SELECT_CLASS}`}>
            <option value="">— None —</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qt-date">Quote Date</Label>
          <Input id="qt-date" name="quoteDate" type="date" required defaultValue={today} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qt-valid">Valid Until</Label>
          <Input id="qt-valid" name="validUntil" type="date" />
        </div>
      </div>

      {/* Lines */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Line Items</h3>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="size-3 mr-1" /> Add Line
          </Button>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_80px_100px_32px] gap-2 items-start">
              <div>
                <select
                  className={SELECT_CLASS}
                  value={line.itemId}
                  onChange={(e) => onItemSelect(i, e.target.value)}
                >
                  <option value="">— Item —</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </div>
              <Input
                placeholder="Description"
                value={line.description}
                onChange={(e) => setLine(i, "description", e.target.value)}
                required
              />
              <Input
                placeholder="Qty"
                type="number"
                step="0.0001"
                min="0.0001"
                value={line.quantity}
                onChange={(e) => setLine(i, "quantity", e.target.value)}
              />
              <Input
                placeholder="Unit Price"
                type="number"
                step="0.01"
                min="0"
                value={line.unitPrice}
                onChange={(e) => setLine(i, "unitPrice", e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                disabled={lines.length === 1}
                onClick={() => removeLine(i)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="text-sm space-y-1 text-right">
          <div className="flex gap-8">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">
              {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex gap-8 font-semibold text-base">
            <span>Total</span>
            <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create Quotation"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
