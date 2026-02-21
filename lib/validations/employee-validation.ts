// lib/validations/employee-onboarding.ts
import { z } from 'zod';

// ─── Reusable ────────────────────────────────────────────────────────────────
const req = (label: string) =>
  z.string({ message: `${label} is required` }).min(1, `${label} is required`);

// ─── KYC document types ──────────────────────────────────────────────────────
export const EMPLOYEE_DOC_TYPES = [
  'id_front',
  'id_back',
  'address_proof',
  'tax_certificate',
  'payslip_1',
  'payslip_2',
  'bank_statement',
  'employment_contract',
] as const;

export type EmployeeDocumentType = (typeof EMPLOYEE_DOC_TYPES)[number];
export const employeeDocumentTypeSchema = z.enum(EMPLOYEE_DOC_TYPES);

// ─── Main KYC submission schema ──────────────────────────────────────────────
export const employeeOnboardingSchema = z.object({
  // Employer linkage — must be a valid UUID from employer_onboarding
  employer_id: z.string().uuid('Invalid employer selected'),
  employee_code: z.string().optional(),

  // Identity
  national_id: req('ID / Passport number'),
  id_type: z.enum(['national_id', 'passport']),
  nationality: z.string().optional(), // required when id_type === 'passport', enforced below
  date_of_birth: z.string().min(1, 'Date of birth is required'),

  // Address
  country: req('Country of work'),
  address_line1: req('Address line 1'),
  address_line2: z.string().optional(),
  city: req('City'),
  postal_code: z.string().optional(),

  // Tax
  tax_id: z.string().optional(),

  // Employment
  job_title: req('Job title'),
  department: z.string().optional(),
  employment_type: req('Employment type'),
  start_date: z.string().optional(),
  monthly_salary: z
    .number({ message: 'Monthly salary is required' })
    .positive('Monthly salary must be positive'),

  // Payment
  bank_name: req('Bank name'),
  bank_account: req('Bank account number'),
  mobile_money_provider: req('Mobile money provider'),
  mobile_money_number: req('Mobile money number'),

  // Document URLs (already uploaded via /kyc/documents before submit)
  id_front: z.string().url('ID front document is required').min(1),
  id_back: z.string().url().optional().or(z.literal('')),
  address_proof: z.string().url('Proof of address is required').min(1),
  tax_certificate: z.string().url().optional().or(z.literal('')),
  payslip_1: z.string().url('At least one payslip is required').min(1),
  payslip_2: z.string().url().optional().or(z.literal('')),
  bank_statement: z.string().url('Bank statement is required').min(1),
  employment_contract: z.string().url('Employment contract is required').min(1),
}).superRefine((data, ctx) => {
  // Passport holders must provide nationality
  if (data.id_type === 'passport' && !data.nationality) {
    ctx.addIssue({
      path: ['nationality'],
      code: z.ZodIssueCode.custom,
      message: 'Nationality is required for passport holders',
    });
  }
});

export type EmployeeOnboardingPayload = z.infer<typeof employeeOnboardingSchema>;