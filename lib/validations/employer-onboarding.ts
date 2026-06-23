import { z } from 'zod';

const nonEmptyString = (label: string) =>
  z.string({ message: `${label} is required` }).min(1, `${label} is required`);

export const beneficialOwnerSchema = z.object({
  full_name: nonEmptyString('Full name'),
  id_number: nonEmptyString('ID number'),
  nationality: z.string().optional(),
  ownership_percentage: z
    .number()
    .min(0)
    .max(100)
    .default(0),
  is_pep: z.boolean().default(false),
});

export type BeneficialOwner = z.infer<typeof beneficialOwnerSchema>;


export const onboardingSubmitSchema = z.object({
  company_name: nonEmptyString('Company name'),
  registration_number: nonEmptyString('Registration number'),
  date_of_incorporation: z.string().optional(),
  country: nonEmptyString('Country'),

  physical_address: nonEmptyString('Physical address'),
  city: nonEmptyString('City'),
  postal_code: z.string().optional(),
  county_region: z.string().optional(),

  tax_id: z.string().optional(),
  vat_number: z.string().optional(),

  industry: nonEmptyString('Industry'),
  sector: nonEmptyString('Sector'),
  business_description: z.string().optional(),
  years_in_operation: z.number().int().min(0).optional(),
  employee_count: z.number().int().min(0),
  countries_of_operation: z.array(z.string()).min(1, 'Select at least one country of operation'),

  annual_revenue_range: z.string().optional(),
  payroll_cycle: nonEmptyString('Payroll cycle'),
  monthly_payroll_amount: z.number().min(0).optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  mobile_money_provider: z.string().optional(),

  contact_person: nonEmptyString('Contact person'),
  contact_email: z.string().email('Invalid email address'),
  contact_phone: nonEmptyString('Contact phone'),
  contact_position: z.string().optional(),

  beneficial_owners: z.array(beneficialOwnerSchema).optional().default([]),

  certificate_of_incorporation: z.string().optional().or(z.literal('')),
  business_registration: z.string().optional().or(z.literal('')),
  tax_compliance_certificate: z.string().optional().or(z.literal('')),
  cr12_document: z.string().optional().or(z.literal('')),
  kra_pin_certificate: z.string().optional().or(z.literal('')),
  business_permit: z.string().optional().or(z.literal('')),
  audited_financials: z.string().optional().or(z.literal('')),
  bank_statement: z.string().optional().or(z.literal('')),
  proof_of_address: z.string().optional().or(z.literal('')),
  proof_of_bank_account: z.string().optional().or(z.literal('')),
  employment_contract_template: z.string().optional().or(z.literal('')),
});

export type OnboardingSubmitPayload = z.infer<typeof onboardingSubmitSchema>;

export const stepUpdateSchema = z.object({
  step: z.number().int().min(0).max(7),
});

export const ALLOWED_DOC_TYPES = [
  'certificate_of_incorporation',
  'business_registration',
  'tax_compliance_certificate',
  'cr12_document',
  'kra_pin_certificate',
  'business_permit',
  'audited_financials',
  'bank_statement',
  'proof_of_address',
  'proof_of_bank_account',
  'employment_contract_template',
] as const;

export type DocumentType = (typeof ALLOWED_DOC_TYPES)[number];

export const documentTypeSchema = z.enum(ALLOWED_DOC_TYPES);