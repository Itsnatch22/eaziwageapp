/**
 * TABLE AUTHORITY RULES — READ THIS BEFORE WRITING ANY EMPLOYER QUERY
 *
 * employer_onboarding → use for: onboarding flow, KYC review, admin approval route
 *   max_advance_percentage, cooldown_period, min_advance_amount
 *
 * employers → use for: advance eligibility, disbursement, fraud checks, wallet ops
 *   advance_limit_percent, cooldown_days, min_advance_amount, processing_fee
 *   ewa_enabled, disbursements_frozen, is_defaulted, auto_approve, weekend_access
 *
 * NEVER read advance eligibility columns from employer_onboarding
 * NEVER write operational settings to employer_onboarding
 *
 * Canonical column names per table — always reference these constants so that
 * IDE rename and grep can track every usage across the codebase.
 */

export const ONBOARDING_COLUMNS = {
  advanceLimitPercent: 'max_advance_percentage', // employer_onboarding
  cooldownPeriod:      'cooldown_period',         // employer_onboarding
} as const;

export const EMPLOYER_COLUMNS = {
  advanceLimitPercent: 'advance_limit_percent',  // employers
  cooldownPeriod:      'cooldown_days',           // employers
} as const;

// DB stores risk_score on a 0–5 scale. All threshold comparisons must use
// these constants — never inline numbers that could be confused with 0–100 scale.
export const RISK_SCORE = {
  SCALE: { MIN: 0, MAX: 5 },
  THRESHOLDS: {
    LOW:      1.5,
    MEDIUM:   2.5,
    HIGH:     3.75,
    CRITICAL: 4.5,
  },
} as const;
