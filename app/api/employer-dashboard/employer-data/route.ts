// app/api/employer/employer-data/route.ts
//
// GET — Returns the authenticated employer's full profile including:
//   - Company details from employer_onboarding
//   - Computed risk_score and risk_rating
//   - Granular risk_factors shaped for the UI's categoryScores structure
//
import { createClient } from '@/lib/client';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Default risk factors when none have been scored yet
const DEFAULT_RISK_FACTORS = {
  legal_compliance: {
    registration_status: 3,
    tax_compliance: 3,
    ewa_agreement: 3,
  },
  financial_health: {
    audited_financials: 3,
    liquidity_ratio: 3,
    payroll_sustainability: 3,
  },
  operational: {
    employee_count: 3,
    churn_rate: 3,
    payroll_integration: 3,
  },
  sector_exposure: {
    industry_risk: 3,
    regulatory_exposure: 3,
  },
  aml_transparency: {
    beneficial_ownership: 3,
    pep_screening: 3,
  },
};

export async function GET() {
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Fetch employer profile ────────────────────────────────────────────────
  const { data: employer, error: employerError } = await supabase
    .from('employer_onboarding')
    .select(`
      id,
      company_name,
      industry,
      sector,
      city,
      country,
      employee_count,
      status,
      risk_score,
      risk_rating,
      contact_person,
      contact_email,
      payroll_cycle,
      annual_revenue_range,
      submitted_at,
      created_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employerError) {
    console.error('[employer-data/fetch]', employerError);
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
  }

  // ── Fetch risk factors ────────────────────────────────────────────────────
  const { data: riskFactorsRow } = await supabase
    .from('employer_risk_factors')
    .select('*')
    .eq('employer_id', employer.id)
    .maybeSingle();

  // Shape into the nested structure the UI expects
  const risk_factors = riskFactorsRow
    ? {
        legal_compliance: {
          registration_status: Number(riskFactorsRow.registration_status),
          tax_compliance: Number(riskFactorsRow.tax_compliance),
          ewa_agreement: Number(riskFactorsRow.ewa_agreement),
        },
        financial_health: {
          audited_financials: Number(riskFactorsRow.audited_financials),
          liquidity_ratio: Number(riskFactorsRow.liquidity_ratio),
          payroll_sustainability: Number(riskFactorsRow.payroll_sustainability),
        },
        operational: {
          employee_count: Number(riskFactorsRow.employee_count),
          churn_rate: Number(riskFactorsRow.churn_rate),
          payroll_integration: Number(riskFactorsRow.payroll_integration),
        },
        sector_exposure: {
          industry_risk: Number(riskFactorsRow.industry_risk),
          regulatory_exposure: Number(riskFactorsRow.regulatory_exposure),
        },
        aml_transparency: {
          beneficial_ownership: Number(riskFactorsRow.beneficial_ownership),
          pep_screening: Number(riskFactorsRow.pep_screening),
        },
      }
    : DEFAULT_RISK_FACTORS;

  // ── Check for pending review request ─────────────────────────────────────
  const { data: pendingReview } = await supabase
    .from('risk_review_requests')
    .select('id, status, created_at')
    .eq('employer_id', employer.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ...employer,
    risk_score: Number(employer.risk_score ?? 3.0),
    risk_rating: employer.risk_rating ?? 'B',
    risk_factors,
    has_pending_review: !!pendingReview,
  });
}