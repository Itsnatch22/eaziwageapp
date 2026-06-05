import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CATEGORY_WEIGHTS = {
  legal_compliance:  0.20,  
  financial_health:  0.35,  
  operational:       0.20,  
  sector_exposure:   0.15,  
  aml_transparency:  0.10,  
} as const;

const SUB_FACTOR_WEIGHTS = {
  legal_compliance: {
    registration_status: 0.10,  
    tax_compliance:      0.07,  
    ewa_agreement:       0.03,  
  },
  financial_health: {
    audited_financials:     0.15,  
    liquidity_ratio:        0.10,  
    payroll_sustainability: 0.10,  
  },
  operational: {
    employee_count:      0.05,  
    churn_rate:          0.05,  
    payroll_integration: 0.10,  
  },
  sector_exposure: {
    industry_risk:       0.10,  
    regulatory_exposure: 0.05,  
  },
  aml_transparency: {
    beneficial_ownership: 0.05,  
    pep_screening:        0.05,  
  },
} as const;

const DEFAULT_RISK_FACTORS = {
  legal_compliance: { 
    registration_status: 3, 
    tax_compliance: 3, 
    ewa_agreement: 3 
  },
  financial_health: { 
    audited_financials: 3, 
    liquidity_ratio: 3, 
    payroll_sustainability: 3 
  },
  operational: { 
    employee_count: 3, 
    churn_rate: 3, 
    payroll_integration: 3 
  },
  sector_exposure: { 
    industry_risk: 3, 
    regulatory_exposure: 3 
  },
  aml_transparency: { 
    beneficial_ownership: 3, 
    pep_screening: 3 
  },
} as const;

function calculateCompositeRiskScore(
  riskFactors: {
    readonly legal_compliance: {
      readonly registration_status: number;
      readonly tax_compliance: number;
      readonly ewa_agreement: number;
    };
    readonly financial_health: {
      readonly audited_financials: number;
      readonly liquidity_ratio: number;
      readonly payroll_sustainability: number;
    };
    readonly operational: {
      readonly employee_count: number;
      readonly churn_rate: number;
      readonly payroll_integration: number;
    };
    readonly sector_exposure: {
      readonly industry_risk: number;
      readonly regulatory_exposure: number;
    };
    readonly aml_transparency: {
      readonly beneficial_ownership: number;
      readonly pep_screening: number;
    };
  }
): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Legal & Compliance (20%)
  totalWeightedScore += riskFactors.legal_compliance.registration_status * SUB_FACTOR_WEIGHTS.legal_compliance.registration_status;
  totalWeightedScore += riskFactors.legal_compliance.tax_compliance * SUB_FACTOR_WEIGHTS.legal_compliance.tax_compliance;
  totalWeightedScore += riskFactors.legal_compliance.ewa_agreement * SUB_FACTOR_WEIGHTS.legal_compliance.ewa_agreement;
  totalWeight += CATEGORY_WEIGHTS.legal_compliance;

  // Financial Health (35% - core risk driver)
  totalWeightedScore += riskFactors.financial_health.audited_financials * SUB_FACTOR_WEIGHTS.financial_health.audited_financials;
  totalWeightedScore += riskFactors.financial_health.liquidity_ratio * SUB_FACTOR_WEIGHTS.financial_health.liquidity_ratio;
  totalWeightedScore += riskFactors.financial_health.payroll_sustainability * SUB_FACTOR_WEIGHTS.financial_health.payroll_sustainability;
  totalWeight += CATEGORY_WEIGHTS.financial_health;

  // Operational Dynamics (20%)
  totalWeightedScore += riskFactors.operational.employee_count * SUB_FACTOR_WEIGHTS.operational.employee_count;
  totalWeightedScore += riskFactors.operational.churn_rate * SUB_FACTOR_WEIGHTS.operational.churn_rate;
  totalWeightedScore += riskFactors.operational.payroll_integration * SUB_FACTOR_WEIGHTS.operational.payroll_integration;
  totalWeight += CATEGORY_WEIGHTS.operational;

  // Sector & Regulatory (15%)
  totalWeightedScore += riskFactors.sector_exposure.industry_risk * SUB_FACTOR_WEIGHTS.sector_exposure.industry_risk;
  totalWeightedScore += riskFactors.sector_exposure.regulatory_exposure * SUB_FACTOR_WEIGHTS.sector_exposure.regulatory_exposure;
  totalWeight += CATEGORY_WEIGHTS.sector_exposure;

  // AML / Ownership (10%)
  totalWeightedScore += riskFactors.aml_transparency.beneficial_ownership * SUB_FACTOR_WEIGHTS.aml_transparency.beneficial_ownership;
  totalWeightedScore += riskFactors.aml_transparency.pep_screening * SUB_FACTOR_WEIGHTS.aml_transparency.pep_screening;
  totalWeight += CATEGORY_WEIGHTS.aml_transparency;

  // Final CRS = weighted sum / total weight (should equal 1.0)
  const crs = totalWeightedScore / totalWeight;
  
  // Ensure score is within valid range [0, 5]
  return Math.max(0, Math.min(5, crs));
}

function getRiskRating(crs: number): 'A' | 'B' | 'C' | 'D' {
  if (crs >= 4.0) return 'A';
  if (crs >= 3.0) return 'B';
  if (crs >= 2.6) return 'C';
  return 'D';
}

function calculateApplicationFee(crs: number): number {
  const BASE_FEE = 3.5;
  const RISK_FACTOR = 3.0;
  return BASE_FEE + (RISK_FACTOR * (1 - crs / 5));
}

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: employer, error: empError } = await supabase
    .from('employers')
    .select(
      `id, company_name, industry, country,
       status, risk_score, risk_rating, contact_person, contact_email,
       payroll_cycle, created_at, onboarding_id,
       employer_onboarding!onboarding_id (
         sector,
         city,
         employee_count,
         annual_revenue_range,
         submitted_at
       )`,
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (empError) {
    console.error('[risk-insights] employer fetch:', empError.message);
    return NextResponse.json({ error: empError.message }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json(
      { 
        error: 'No employer profile found. Please complete onboarding first.',
        suggestion: 'Complete the employer onboarding process to access risk insights.'
      },
      { status: 404 },
    );
  }
  const onboarding = Array.isArray(employer.employer_onboarding)
    ? employer.employer_onboarding[0]
    : employer.employer_onboarding;

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
    .eq('employer_id', employer.onboarding_id)
    .maybeSingle();

  if (rfError) {
    console.warn('[risk-insights] risk_factors fetch:', rfError.message);
  }

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

  let computedCRS = Number(employer.risk_score ?? rf?.composite_score ?? 0);
  let computedRating = employer.risk_rating;

  if (!computedCRS || computedCRS === 0) {
    computedCRS = calculateCompositeRiskScore(risk_factors);
    computedRating = getRiskRating(computedCRS);
    
    console.log('[risk-insights] Computed CRS:', computedCRS, 'Rating:', computedRating);
  }

  const applicationFee = calculateApplicationFee(computedCRS);

  const currencyMap: Record<string, string> = {
    'Kenya': 'KES',
    'Uganda': 'UGX',
    'Tanzania': 'TZS',
    'Rwanda': 'RWF',
    'KE': 'KES',
    'UG': 'UGX',
    'TZ': 'TZS',
    'RW': 'RWF',
  };
  const currency = currencyMap[employer.country] || 'KES';

  const { data: pendingReview } = await supabase
    .from('risk_review_requests')
    .select('id, created_at, message')
    .eq('employer_id', employer.onboarding_id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();
  const pendingReviewPayload = pendingReview
    ? {
        ...pendingReview,
        requested_at: pendingReview.created_at,
        reason: pendingReview.message,
      }
    : null;

  return NextResponse.json({
    id:                   employer.id,
    company_name:         employer.company_name,
    industry:             employer.industry,
    sector:               onboarding?.sector,
    city:                 onboarding?.city,
    country:              employer.country,
    currency:             currency,
    employee_count:       onboarding?.employee_count,
    status:               employer.status,
    contact_person:       employer.contact_person,
    contact_email:        employer.contact_email,
    payroll_cycle:        employer.payroll_cycle,
    annual_revenue_range: onboarding?.annual_revenue_range,
    submitted_at:         onboarding?.submitted_at,

    // Risk Scoring (Framework Compliant)
    risk_score:  computedCRS,
    risk_rating: computedRating ?? 'B',
    application_fee: applicationFee,
    risk_factors,


    // Category Weights (for client-side display)
    category_weights: CATEGORY_WEIGHTS,
    sub_factor_weights: SUB_FACTOR_WEIGHTS,

    // Metadata
    risk_scored_at:     rf?.scored_at ?? null,
    risk_notes:         rf?.notes     ?? null,
    has_pending_review: !!pendingReviewPayload || employer.status === 'risk_review_in_progress',
    pending_review:     pendingReviewPayload,

    // Framework Version
    framework_version: 'REV1',
    framework_date: '2025-10-25',
  });
}
