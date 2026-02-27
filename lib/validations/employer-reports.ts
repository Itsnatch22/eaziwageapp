
import { z } from 'zod';

// ─── Query Params ─────────────────────────────────────────────────────────────

export const ReportPeriodEnum = z.enum([
  'this_week',
  'this_month',
  'last_month',
  'this_quarter',
  'this_year',
  'custom',
]);
export type ReportPeriod = z.infer<typeof ReportPeriodEnum>;

export const ReportsQuerySchema = z.object({
  period: ReportPeriodEnum.optional().default('this_month'),
  /** ISO month string: 'YYYY-MM'. Overrides period when supplied. */
  month:  z.string().regex(/^\d{4}-\d{2}$/).optional(),
  /** Explicit date range — only used when period = 'custom' */
  from:   z.string().datetime({ offset: true }).optional(),
  to:     z.string().datetime({ offset: true }).optional(),
});
export type ReportsQuery = z.infer<typeof ReportsQuerySchema>;

// ─── Response shape ───────────────────────────────────────────────────────────

export const AdvanceSummarySchema = z.object({
  total:          z.number(),
  disbursed:      z.number(),
  pending:        z.number(),
  rejected:       z.number(),
  total_amount:   z.number(),
  total_fees:     z.number(),
  avg_amount:     z.number(),
  by_method: z.object({
    mobile_money:  z.number(),
    bank_transfer: z.number(),
  }),
});
export type AdvanceSummary = z.infer<typeof AdvanceSummarySchema>;

export const EmployeeSummarySchema = z.object({
  total:             z.number(),
  active:            z.number(),
  with_advances:     z.number(),
  utilization_rate:  z.number(),  // 0-100
});
export type EmployeeSummary = z.infer<typeof EmployeeSummarySchema>;

export const PeriodTrendSchema = z.object({
  label:    z.string(),
  amount:   z.number(),
  count:    z.number(),
});
export type PeriodTrend = z.infer<typeof PeriodTrendSchema>;

export const ReportsResponseSchema = z.object({
  period: z.object({
    label: z.string(),
    from:  z.string(),
    to:    z.string(),
  }),
  advances:  AdvanceSummarySchema,
  employees: EmployeeSummarySchema,
  risk_score:   z.number().nullable(),
  risk_rating:  z.string().nullable(),
  /** Previous-period amounts for computing % change badges */
  previous_period: z.object({
    total_amount: z.number(),
    total_fees:   z.number(),
  }),
  monthly_trend: z.array(PeriodTrendSchema),
});
export type ReportsResponse = z.infer<typeof ReportsResponseSchema>;
