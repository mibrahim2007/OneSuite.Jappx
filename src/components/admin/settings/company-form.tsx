"use client";

import { useActionState, startTransition, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanyProfileAction } from "@/server/actions/settings";
import { SELECT_CLASS } from "@/lib/ui-constants";

const clientSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  legalName: z.string().max(200).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Must be a valid hex color like #3b82f6")
    .or(z.literal(""))
    .optional(),
  baseCurrency: z.string().length(3, "Select a currency"),
  timezone: z.string().min(1, "Select a timezone"),
  fiscalStartMonth: z.number().int().min(1).max(12),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
});

type FormValues = z.infer<typeof clientSchema>;

const CURRENCIES = [
  { code: "PKR", label: "PKR — Pakistani Rupee" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SAR", label: "SAR — Saudi Riyal" },
];

const TIMEZONES = [
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Dubai",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type AddressShape = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
};

type CompanyFormProps = {
  defaultValues: {
    name: string;
    legalName: string | null;
    logoUrl: string | null;
    accentColor: string | null;
    baseCurrency: string;
    timezone: string;
    fiscalStartMonth: number;
    settings: unknown;
  };
};

export function CompanyForm({ defaultValues }: CompanyFormProps) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(defaultValues.logoUrl);
  const [state, formAction, isPending] = useActionState(updateCompanyProfileAction, null);

  const address =
    ((defaultValues.settings as Record<string, unknown>)?.address as AddressShape) ?? {};

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: defaultValues.name,
      legalName: defaultValues.legalName ?? "",
      accentColor: defaultValues.accentColor ?? "",
      baseCurrency: defaultValues.baseCurrency,
      timezone: defaultValues.timezone,
      fiscalStartMonth: defaultValues.fiscalStartMonth,
      addressLine1: address.line1 ?? "",
      addressLine2: address.line2 ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      country: address.country ?? "",
      postalCode: address.postalCode ?? "",
    },
  });

  const watchedAccent = form.watch("accentColor");

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      toast.success("Settings saved.");
    }
  }, [state, router]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setLogoPreview(URL.createObjectURL(file));
  }

  function onSubmit(values: FormValues) {
    const fd = new FormData();
    fd.append("name", values.name);
    fd.append("legalName", values.legalName ?? "");
    fd.append("accentColor", values.accentColor ?? "");
    fd.append("baseCurrency", values.baseCurrency);
    fd.append("timezone", values.timezone);
    fd.append("fiscalStartMonth", String(values.fiscalStartMonth));
    fd.append("addressLine1", values.addressLine1 ?? "");
    fd.append("addressLine2", values.addressLine2 ?? "");
    fd.append("city", values.city ?? "");
    fd.append("state", values.state ?? "");
    fd.append("country", values.country ?? "");
    fd.append("postalCode", values.postalCode ?? "");
    if (logoInputRef.current?.files?.[0]) {
      fd.append("logo", logoInputRef.current.files[0]);
    }
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Organization Name *</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="legalName">Legal Name</Label>
            <Input
              id="legalName"
              {...form.register("legalName")}
              placeholder="Full registered legal name"
            />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="logo-input">Logo (PNG, JPEG, or WebP · max 2 MB)</Label>
            {logoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Organization logo preview"
                className="h-14 w-auto rounded border border-border object-contain"
              />
            )}
            <input
              id="logo-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              ref={logoInputRef}
              onChange={handleLogoChange}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accentColor">Accent Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick accent color"
                value={watchedAccent || "#3b82f6"}
                onChange={(e) =>
                  form.setValue("accentColor", e.target.value, { shouldValidate: true })
                }
                className="size-10 cursor-pointer rounded border border-input bg-background p-0.5"
              />
              <Input
                id="accentColor"
                {...form.register("accentColor")}
                placeholder="#3b82f6"
                className="w-32 font-mono"
              />
            </div>
            {form.formState.errors.accentColor && (
              <p className="text-xs text-destructive">
                {form.formState.errors.accentColor.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Regional & Accounting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regional & Accounting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="baseCurrency">Base Currency</Label>
            <select id="baseCurrency" {...form.register("baseCurrency")} className={SELECT_CLASS}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <select id="timezone" {...form.register("timezone")} className={SELECT_CLASS}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fiscalStartMonth">Fiscal Year Start Month</Label>
            <select
              id="fiscalStartMonth"
              {...form.register("fiscalStartMonth", { valueAsNumber: true })}
              defaultValue={String(defaultValues.fiscalStartMonth)}
              className={SELECT_CLASS}
            >
              {MONTHS.map((month, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {month}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              The fiscal year runs 12 months starting from this month.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input id="addressLine1" {...form.register("addressLine1")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input id="addressLine2" {...form.register("addressLine2")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...form.register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State / Province</Label>
              <Input id="state" {...form.register("state")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...form.register("country")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input id="postalCode" {...form.register("postalCode")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {state && !state.success && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save Settings"}
      </Button>
    </form>
  );
}
