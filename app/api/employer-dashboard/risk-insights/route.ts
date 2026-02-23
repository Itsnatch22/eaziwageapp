// app/api/employer-dashboard/risk-insights/route.ts
//
// GET /api/employer-dashboard/risk-insights
//
// Returns the authenticated employer's full risk profile in one call:
//
//   {
//     id, company_name, contact_person, contact_email,
//     industry, sector, city, country, status,
//     risk_score: number,          // 0–5 composite
//     risk_rating: 'A'|'B'|'C'|'D',
//     risk_factors: {
//       legal_compliance:  { registration_status, tax_compliance, ewa_agreement },
//       financial_health:  { audited_financials, liquidity_ratio, payroll_sustainability },
//       operational:       { employee_count, churn_rate, payroll_integration },
//       sector_exposure:   { industry_risk, regulatory_exposure },
//       aml_transparency:  { beneficial_ownership, pep_screening },
//     },
//     risk_scored_at: string | null,
//     has_pending_review: boolean,
//   }
//
// The page derives feePercentage client-side via calculateFeePercentage(risk_score).
//
import { createClient } from '@/lib/client';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Returned when no risk_factors row exists yet (new employers).
// All sub-factors default to 3 → composite 3.0 → rating B.
const DEFAULT_RISK_FACTORS = {
  legal_compliance: { registration_status: 3, tax_compliance: 3, ewa_agreement: 3 },
  financial_health: { audited_financials: 3, liquidity_ratio: 3, payroll_sustainability: 3 },
  operational:      { employee_count: 3, churn_rate: 3, payroll_integration: 3 },
  sector_exposure:  { industry_risk: 3, regulatory_exposure: 3 },
  aml_transparency: { beneficial_ownership: 3, pep_screening: 3 },
} as const;

export async function GET() {
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Employer profile ──────────────────────────────────────────────────────
  // risk_score + risk_rating live on employer_onboarding, kept in sync
  // automatically by the Postgres trigger fn_sync_employer_risk_score.
  const { data: employer, error: empError } = await supabase
    .from('employer_onboarding')
    .select(
      `id, company_name, industry, sector, city, country, employee_count,
       status, risk_score, risk_rating, contact_person, contact_email,
       payroll_cycle, annual_revenue_range, submitted_at, created_at`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (empError) {
    console.error('[risk-insights] employer fetch:', empError.message);
    return NextResponse.json({ error: empError.message }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json(
      { error: 'No employer profile found. Please complete onboarding first.' },
      { status: 404 },
    );
  }

  // ── Per-category sub-factor scores ────────────────────────────────────────
  const { data: rf, error: rfError } = await supabase
    .from('employer_risk_factors')
    .select(
      `registration_status, tax_compliance, ewa_agreement,
       audited_financials, liquidity_ratio, payroll_sustainability,
       employee_count, churn_rate, payroll_integration,
       industry_risk, regulatory_exposure,
       beneficial_ownership, pep_screening,
       composite_score, scored_at, notes`,
    )
    .eq('employer_id', employer.id)
    .maybeSingle();

  if (rfError) {
    // Non-fatal: fall back to defaults
    console.error('[risk-insights] risk_factors fetch:', rfError.message);
  }

  // Map flat DB columns → nested categoryScores shape the page expects
  const risk_factors = rf
    ? {
        legal_compliance: {
          registration_status: Number(rf.registration_status),
          tax_compliance:      Number(rf.tax_compliance),
          ewa_agreement:       Number(rf.ewa_agreement),
        },
        financial_health: {
          audited_financials:     Number(rf.audited_financials),
          liquidity_ratio:        Number(rf.liquidity_ratio),
          payroll_sustainability: Number(rf.payroll_sustainability),
        },
        operational: {
          employee_count:      Number(rf.employee_count),
          churn_rate:          Number(rf.churn_rate),
          payroll_integration: Number(rf.payroll_integration),
        },
        sector_exposure: {
          industry_risk:       Number(rf.industry_risk),
          regulatory_exposure: Number(rf.regulatory_exposure),
        },
        aml_transparency: {
          beneficial_ownership: Number(rf.beneficial_ownership),
          pep_screening:        Number(rf.pep_screening),
        },
      }
    : DEFAULT_RISK_FACTORS;

  // ── Pending review flag ───────────────────────────────────────────────────
  const { data: pendingReview } = await supabase
    .from('risk_review_requests')
    .select('id')
    .eq('employer_id', employer.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    // Identity
    id:                   employer.id,
    company_name:         employer.company_name,
    industry:             employer.industry,
    sector:               employer.sector,
    city:                 employer.city,
    country:              employer.country,
    employee_count:       employer.employee_count,
    status:               employer.status,
    contact_person:       employer.contact_person,
    contact_email:        employer.contact_email,
    payroll_cycle:        employer.payroll_cycle,
    annual_revenue_range: employer.annual_revenue_range,
    submitted_at:         employer.submitted_at,

    // Risk — prefer synced employer_onboarding values; fall back to raw
    // composite_score for employers bootstrapped before a trigger fires
    risk_score:  Number(employer.risk_score  ?? rf?.composite_score ?? 3.0),
    risk_rating: employer.risk_rating ?? 'B',
    risk_factors,

    // Metadata
    risk_scored_at:     rf?.scored_at ?? null,
    risk_notes:         rf?.notes     ?? null,
    has_pending_review: !!pendingReview,
  });
}