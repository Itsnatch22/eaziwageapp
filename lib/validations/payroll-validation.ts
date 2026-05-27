import { z } from 'zod';

export const PAYROLL_PROVIDERS = [
  'SAP',
  'Oracle',
  'Sage',
  'QuickBooks',
  'Workday',
  'Paychex',
  'BambooHR',
  'Gusto',
  'Custom',
] as const;

export type PayrollProvider = (typeof PAYROLL_PROVIDERS)[number];

export const connectPayrollSchema = z.object({
  provider:        z.enum(PAYROLL_PROVIDERS).default('SAP'),
  provider_label:  z.string().max(80).optional(),
  sync_mode:       z.enum(['auto', 'manual']).default('manual'),
  sync_frequency:  z.enum(['realtime', 'hourly', 'daily', 'weekly', 'monthly']).default('daily'),
  sync_time:       z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'sync_time must be HH:MM')
    .default('06:00'),
});

export type ConnectPayrollPayload = z.infer<typeof connectPayrollSchema>;

export const payrollRowSchema = z.object({
  employee_code: z.string().min(1, 'employee_code is required'),
  days_worked:   z.number().min(0).max(31).optional(),
  gross_salary:  z.number().nonnegative('gross_salary must be ≥ 0'),
  deductions:    z.number().nonnegative().default(0),
});

export type PayrollRow = z.infer<typeof payrollRowSchema>;

export const uploadPayrollSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM'),
  employees: z
    .array(payrollRowSchema)
    .min(1, 'At least one employee row is required')
    .max(5000, 'Cannot upload more than 5,000 rows at once'),
  file_name:        z.string().optional(),
  file_size_bytes:  z.number().optional(),
});

export type UploadPayrollPayload = z.infer<typeof uploadPayrollSchema>;

export const triggerSyncSchema = z.object({
  integration_id: z.string().uuid('integration_id must be a UUID'),
});

export type TriggerSyncPayload = z.infer<typeof triggerSyncSchema>;