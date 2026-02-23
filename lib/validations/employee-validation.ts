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

// ─── Employee document types ──────────────────────────────────────────────────
export const employeeDocumentTypeSchema = z.enum([
  'id_front',
  'id_back',
  'address_proof',
  'tax_certificate',
  'payslip_1',
  'payslip_2',
  'employment_contract',
  'bank_statement',
  'selfie',
  'national_id',
  'passport',
  'payslip',
  'utility_bill',
]);

export type EmployeeDocumentType = z.infer<typeof employeeDocumentTypeSchema>;

// ─── Employee list query params ───────────────────────────────────────────────
export const employeeListQuerySchema = z.object({
  status: z.enum(['approved', 'pending', 'rejected', 'options', '']).optional(),
  department: z.string().optional(),
  country: z.string().optional(),
  search: z.string().optional(),
  from: z.string().optional(),  // ISO date
  to: z.string().optional(),    // ISO date
});

export const employeeOnboardingSchema = z.object({
  employer_id: z.string().uuid('Invalid employer ID'),
  employee_code: z.string().optional(),
  national_id: z.string().min(1, 'National ID is required'),
  id_type: z.enum(['national_id', 'passport']),
  nationality: z.string().optional(),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  country: z.string().min(1, 'Country is required'),
  address_line1: z.string().min(1, 'Address line 1 is required'),
  address_line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  postal_code: z.string().optional(),
  tax_id: z.string().optional(),
  job_title: z.string().min(1, 'Job title is required'),
  department: z.string().optional(),
  employment_type: z.string().min(1, 'Employment type is required'),
  start_date: z.string().optional(),
  monthly_salary: z.number().nonnegative('Monthly salary must be 0 or more'),
  bank_name: z.string().min(1, 'Bank name is required'),
  bank_account: z.string().min(1, 'Bank account is required'),
  mobile_money_provider: z.string().min(1, 'Mobile money provider is required'),
  mobile_money_number: z.string().min(1, 'Mobile money number is required'),
  id_front: z.string().url().optional(),
  id_back: z.string().url().optional(),
  address_proof: z.string().url().optional(),
  tax_certificate: z.string().url().optional(),
  payslip_1: z.string().url().optional(),
  payslip_2: z.string().url().optional(),
  bank_statement: z.string().url().optional(),
  employment_contract: z.string().url().optional(),
});

export type EmployeeOnboardingPayload = z.infer<typeof employeeOnboardingSchema>;
