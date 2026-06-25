import { z } from "zod";

export const PERIOD_STATUSES = ["open", "closed", "locked"] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  open: "Open",
  closed: "Closed",
  locked: "Locked",
};

export const createFiscalYearSchema = z.object({
  startYear: z.coerce
    .number()
    .int()
    .min(2000, "Year must be 2000 or later")
    .max(2100, "Year must be 2100 or earlier"),
});

export type CreateFiscalYearValues = z.infer<typeof createFiscalYearSchema>;
