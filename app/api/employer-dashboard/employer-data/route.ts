import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: employer, error: employerError } = await supabase
    .from('employers')
    .select(`
      id,
      company_name,
      industry,
      country,
      status,
      risk_score,
      risk_rating,
      contact_person,
      contact_email,
      payroll_cycle,
      created_at,
      onboarding_id,
      employer_onboarding!onboarding_id (
        sector,
        city,
        employee_count,
        annual_revenue_range,
        submitted_at
      )
    `)
    .eq('user_id', user.id)
    .maybeSingle();

  if (employerError) {
    console.error('[employer-data/fetch]', employerError);
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
  }
  const onboarding = Array.isArray(employer.employer_onboarding)
    ? employer.employer_onboarding[0]
    : employer.employer_onboarding;

  const { data: riskFactorsRow } = await supabase
    .from('employer_risk_factors')
    .select('*')
    .eq('employer_id', employer.onboarding_id)
    .maybeSingle();

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

  const { data: pendingReview } = await supabase
    .from('risk_review_requests')
    .select('id, status, created_at')
    .eq('employer_id', employer.onboarding_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    id: employer.id,
    company_name: employer.company_name,
    industry: employer.industry,
    country: employer.country,
    status: employer.status,
    contact_person: employer.contact_person,
    contact_email: employer.contact_email,
    payroll_cycle: employer.payroll_cycle,
    created_at: employer.created_at,
    onboarding_id: employer.onboarding_id,
    ...onboarding,
    risk_score: Number(employer.risk_score ?? 3.0),
    risk_rating: employer.risk_rating ?? 'B',
    risk_factors,
    has_pending_review: !!pendingReview,
  });
}
