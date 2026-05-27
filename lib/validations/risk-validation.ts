import { z } from 'zod';
export const reviewRequestSchema = z.object({
  employerId: z.string().uuid('Invalid employer ID'),
  type: z.string().min(1).default('risk_review'),
  message: z.string().min(1, 'Message is required').max(1000),
});

export type ReviewRequestPayload = z.infer<typeof reviewRequestSchema>;

export const riskFactorSchema = z.object({
  legal_compliance: z.object({
    registration_status: z.number(),
    tax_compliance: z.number(),
    ewa_agreement: z.number(),
  }),
  financial_health: z.object({
    audited_financials: z.number(),
    liquidity_ratio: z.number(),
    payroll_sustainability: z.number(),
  }),
  operational: z.object({
    employee_count: z.number(),
    churn_rate: z.number(),
    payroll_integration: z.number(),
  }),
  sector_exposure: z.object({
    industry_risk: z.number(),
    regulatory_exposure: z.number(),
  }),
  aml_transparency: z.object({
    beneficial_ownership: z.number(),
    pep_screening: z.number(),
  }),
});

export type RiskFactors = z.infer<typeof riskFactorSchema>;