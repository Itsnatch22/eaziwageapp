import { z } from 'zod';

// ─── EWA settings update ─────────────────────────────────────────────────────
export const ewaSettingsSchema = z.object({
  ewa_enabled: z.boolean(),
  max_advance_percentage: z
    .number()
    .int()
    .min(10, 'Must be at least 10%')
    .max(100, 'Cannot exceed 100%'),
  min_advance_amount: z
    .number()
    .nonnegative('Must be 0 or more'),
  max_advance_amount: z
    .number()
    .positive('Must be greater than 0'),
  cooldown_period: z
    .number()
    .int()
    .min(0, 'Must be 0 or more')
    .max(30, 'Cannot exceed 30 days'),
}).refine(
  (d) => d.max_advance_amount >= d.min_advance_amount,
  { message: 'Max amount must be ≥ min amount', path: ['max_advance_amount'] },
);

export type EWASettingsPayload = z.infer<typeof ewaSettingsSchema>;

// ─── Employee list query params ───────────────────────────────────────────────
export const employeeListQuerySchema = z.object({
  status: z.enum(['approved', 'pending', 'rejected', '']).optional(),
  department: z.string().optional(),
  country: z.string().optional(),
  search: z.string().optional(),
  from: z.string().optional(),  // ISO date
  to: z.string().optional(),    // ISO date
});