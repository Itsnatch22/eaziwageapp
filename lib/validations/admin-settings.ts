import { z } from 'zod';

// Monetary fields (min/max_advance_amount, mobile_fee, bank_fee) are denominated in
// USD, matching the rest of the platform (see /api/admin/billing, /api/admin/dashboard)
// — these are platform-wide defaults spanning KE/UG/TZ/RW, so a single local-currency
// value would be meaningless across countries with very different unit values.
export const GlobalPlatformSettingsSchema = z.object({
  default_advance_percent: z.number().min(10).max(80).optional(),
  min_advance_amount: z.number().min(1).optional(),
  max_advance_amount: z.number().optional(),
  daily_advance_limit: z.number().min(1).optional(),
  min_processing_fee: z.number().min(0).optional(),
  max_processing_fee: z.number().optional(),
  mobile_fee: z.number().optional(),
  bank_fee: z.number().optional(),
  default_cooldown_days: z.number().min(0).optional(),
  weekly_advance_limit: z.number().optional(),
  monthly_advance_limit: z.number().optional(),
  new_employee_wait_days: z.number().optional(),
  instant_mobile_enabled: z.boolean().optional(),
  bank_transfers_enabled: z.boolean().optional(),
  auto_approval_enabled: z.boolean().optional(),
  weekend_advances_enabled: z.boolean().optional(),
  enabled_countries: z.array(z.string()).optional(),
  // Minimum admin_wallets (Main Stanbic Source) USD balance before the
  // low-balance banner and topup-approval warning kick in. See
  // app/admin/wallet/AdminWalletClient.tsx and the topup-requests approve route.
  low_balance_threshold_usd: z.number().min(0).optional(),
});

// risk_score (employers.risk_score / employees.risk_score) is stored on a 0–5
// scale where HIGHER = SAFER (confirmed against the existing rating derivations
// in app/api/admin/settings/employees/route.ts and RiskScoringClient.tsx's
// getRating(), both of which treat a high score as low risk). These thresholds
// must use the same scale and direction so a single admin-configured number
// drives both the employer A/B/C rating bands and the employee disbursement
// risk check in lib/services/payout-service.ts.
export const RiskSettingsSchema = z.object({
  employer_low_threshold: z.number().min(0).max(5).optional(),
  employer_medium_threshold: z.number().min(0).max(5).optional(),
  employee_low_threshold: z.number().min(0).max(5).optional(),
  employee_medium_threshold: z.number().min(0).max(5).optional(),
  auto_suspend_threshold: z.number().min(0).max(5).optional(),
  reduce_limits_threshold: z.number().min(0).max(5).optional(),
  auto_suspend_on_fraud: z.boolean().optional(),
  auto_reduce_on_warning: z.boolean().optional(),
  notify_on_high_risk: z.boolean().optional(),
  require_id_verification: z.boolean().optional(),
  require_face_id: z.boolean().optional(),
  require_address_proof: z.boolean().optional(),
  require_employment_contract: z.boolean().optional(),
  reverification_frequency: z.enum(['monthly', 'quarterly', 'biannually', 'annually', 'never']).optional(),
});

export const NotificationSettingsSchema = z.object({
  email_new_employer: z.boolean().optional(),
  email_large_advance: z.boolean().optional(),
  email_fraud_alert: z.boolean().optional(),
  email_daily_summary: z.boolean().optional(),
  email_weekly_report: z.boolean().optional(),
  sms_fraud_alert: z.boolean().optional(),
  sms_system_alert: z.boolean().optional(),
  sms_large_transaction: z.boolean().optional(),
  large_advance_threshold: z.number().optional(),
  daily_volume_threshold: z.number().optional(),
  fraud_alert_emails: z.string().optional(),
  admin_sms_numbers: z.string().optional(),
});

export const EmployerSettingsSchema = z.object({
  advance_limit_percent: z.number().min(10).max(80).optional(),
  cooldown_days: z.number().min(0).optional(),
  processing_fee: z.number().optional(),
  max_monthly_advances: z.number().optional(),
  min_advance_amount: z.number().min(500).optional(),
  employee_advance_limit_min: z.number().optional(),
  employee_advance_limit_max: z.number().optional(),
  employee_cooldown_min: z.number().optional(),
  employee_cooldown_max: z.number().optional(),
  funding_model: z.enum(['prefunded', 'debit_order', 'invoice']).optional(),
  risk_tier: z.enum(['low', 'medium', 'high']).optional(),
  funding_buffer_percent: z.number().optional(),
  credit_limit: z.number().optional(),
  ewa_enabled: z.boolean().optional(),
  instant_enabled: z.boolean().optional(),
  auto_approve: z.boolean().optional(),
  weekend_access: z.boolean().optional(),
});

export const EmployeeSettingsSchema = z.object({
  use_custom_settings: z.boolean().optional(),
  advance_limit_percent: z.number().optional(),
  cooldown_days: z.number().optional(),
  max_monthly_advances: z.number().optional(),
  fee_rate: z.number().optional(),
  ewa_enabled: z.boolean().optional(),
  vip_status: z.boolean().optional(),
  manual_approval: z.boolean().optional(),
  on_watchlist: z.boolean().optional(),
  admin_notes: z.string().optional(),
});

export const BlackoutPeriodSchema = z.object({
  name: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  applies_to: z.string().default('all'),
  reason: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const LegalDocumentSchema = z.object({
  document_type: z.enum(['employee_terms', 'employer_partnership', 'privacy_policy']),
  title: z.string().min(1),
  content: z.string().min(1),
  version: z.string().min(1),
  effective_date: z.string(),
  is_active: z.boolean().default(true),
});
