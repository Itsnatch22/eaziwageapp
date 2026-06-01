import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import pusherServer from '@/lib/pusher-server';


interface RiskFactors {
  registration_status: number;
  tax_compliance: number;
  ewa_agreement: number;
  audited_financials: number;
  liquidity_ratio: number;
  payroll_sustainability: number;
  employee_count: number;
  churn_rate: number;
  payroll_integration: number;
  industry_risk: number;
  regulatory_exposure: number;
  beneficial_ownership: number;
  pep_screening: number;
}


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


function toAdminStatus(status: string | null | undefined): string {
  if (status === 'approved' || status === 'rejected' || status === 'suspended' || status === 'risk_review_in_progress') return status;
  return 'pending';
}


function calculateCompositeRiskScore(rf: Partial<RiskFactors>): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  totalWeightedScore += (rf.registration_status ?? 3) * SUB_FACTOR_WEIGHTS.legal_compliance.registration_status;
  totalWeightedScore += (rf.tax_compliance ?? 3) * SUB_FACTOR_WEIGHTS.legal_compliance.tax_compliance;
  totalWeightedScore += (rf.ewa_agreement ?? 3) * SUB_FACTOR_WEIGHTS.legal_compliance.ewa_agreement;
  totalWeight += CATEGORY_WEIGHTS.legal_compliance;
  
  totalWeightedScore += (rf.audited_financials ?? 3) * SUB_FACTOR_WEIGHTS.financial_health.audited_financials;
  totalWeightedScore += (rf.liquidity_ratio ?? 3) * SUB_FACTOR_WEIGHTS.financial_health.liquidity_ratio;
  totalWeightedScore += (rf.payroll_sustainability ?? 3) * SUB_FACTOR_WEIGHTS.financial_health.payroll_sustainability;
  totalWeight += CATEGORY_WEIGHTS.financial_health;

  totalWeightedScore += (rf.employee_count ?? 3) * SUB_FACTOR_WEIGHTS.operational.employee_count;
  totalWeightedScore += (rf.churn_rate ?? 3) * SUB_FACTOR_WEIGHTS.operational.churn_rate;
  totalWeightedScore += (rf.payroll_integration ?? 3) * SUB_FACTOR_WEIGHTS.operational.payroll_integration;
  totalWeight += CATEGORY_WEIGHTS.operational;

  totalWeightedScore += (rf.industry_risk ?? 3) * SUB_FACTOR_WEIGHTS.sector_exposure.industry_risk;
  totalWeightedScore += (rf.regulatory_exposure ?? 3) * SUB_FACTOR_WEIGHTS.sector_exposure.regulatory_exposure;
  totalWeight += CATEGORY_WEIGHTS.sector_exposure;
  totalWeightedScore += (rf.beneficial_ownership ?? 3) * SUB_FACTOR_WEIGHTS.aml_transparency.beneficial_ownership;
  totalWeightedScore += (rf.pep_screening ?? 3) * SUB_FACTOR_WEIGHTS.aml_transparency.pep_screening;
  totalWeight += CATEGORY_WEIGHTS.aml_transparency;

  const crs = totalWeightedScore / totalWeight;
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


export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employers:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401, headers: rateResult.headers }
    );
  }

  const env = getEnv();
  const adminSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  const adminAccess = await checkAdminAccess({ user, adminSupabase });
  if (adminAccess.error) {
    return NextResponse.json(
      { error: 'Failed to verify role.', code: 'ROLE_CHECK_FAILED' },
      { status: 500, headers: rateResult.headers }
    );
  }

  console.log('[DEBUG /api/admin/employers] user.id:', user.id, '| roleCandidates:', adminAccess.roleCandidates);
  if (!adminAccess.isAdmin) {
    console.warn('[/api/admin/employers] FORBIDDEN â€” roleCandidates did not pass isAdminRole. Values:', adminAccess.roleCandidates);
    return NextResponse.json(
      {
        error: 'Forbidden. Admin access required.',
        code: 'FORBIDDEN',
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            found_roles: adminAccess.roleCandidates,
            allowed_roles: ['admin', 'super_admin', 'compliance', 'employer_admin'],
            hint: 'Update the profiles.role column in Supabase for this user to one of the allowed_roles values.',
          },
        }),
      },
      { status: 403, headers: rateResult.headers }
    );
  }

  
  const searchParams = req.nextUrl.searchParams;
  const statusFilter = searchParams.get('status')?.trim() ?? '';
  const countryFilter = searchParams.get('country')?.trim() ?? '';
  const riskRatingFilter = searchParams.get('risk_rating')?.trim() ?? '';
  const searchFilter = searchParams.get('search')?.trim().toLowerCase() ?? '';

  
  const { data: onboardingRows, error } = await adminSupabase
    .from('employer_onboarding')
    .select(`
      id,
      user_id,
      company_name,
      industry,
      sector,
      country,
      registration_number,
      tax_id,
      physical_address,
      contact_person,
      contact_email,
      contact_phone,
      payroll_cycle,
      status,
      risk_score,
      risk_rating,
      created_at,
      updated_at
    `);

  if (error) {
    console.error('[GET /api/admin/employers] Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employers.', code: 'SERVER_ERROR' },
      { status: 500, headers: rateResult.headers }
    );
  }

  console.log(`[GET /api/admin/employers] Found ${onboardingRows?.length || 0} onboarding records.`);
  if (onboardingRows && onboardingRows.length > 0) {
    console.log(`[GET /api/admin/employers] Sample ID: ${onboardingRows[0].id}`);
  }

  const employerIds = (onboardingRows ?? []).map((row) => row.id);
  const userIds = (onboardingRows ?? []).map((row) => row.user_id).filter(Boolean);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: profileCodes } = await adminSupabase
    .from('profiles')
    .select('id, company_code')
    .in('id', userIds);
  
  const codesByUserId = new Map(profileCodes?.map(p => [p.id, p.company_code]) ?? []);

  const { data: riskFactorsData } = await adminSupabase
    .from('employer_risk_factors')
    .select(`
      employer_id,
      registration_status,
      tax_compliance,
      ewa_agreement,
      audited_financials,
      liquidity_ratio,
      payroll_sustainability,
      employee_count,
      churn_rate,
      payroll_integration,
      industry_risk,
      regulatory_exposure,
      beneficial_ownership,
      pep_screening,
      composite_score,
      scored_at
    `)
    .in('employer_id', employerIds);

  const riskFactorsByEmployer = new Map<string, RiskFactors & { employer_id: string; scored_at: string | null }>();
  (riskFactorsData ?? []).forEach((rf) => {
    riskFactorsByEmployer.set(rf.employer_id, rf as RiskFactors & { employer_id: string; scored_at: string | null });
  });

  const [employeesResult, advancesResult] = await Promise.all([
    employerIds.length
      ? adminSupabase
          .from('employees')
          .select('employer_id, monthly_salary, status')
          .in('employer_id', employerIds)
      : Promise.resolve({ data: [] as Array<{ employer_id: string; monthly_salary: number | null; status: string | null }> }),
    employerIds.length
      ? adminSupabase
          .from('advances')
          .select('employer_id, amount, created_at')
          .in('employer_id', employerIds)
          .gte('created_at', startOfMonth)
      : Promise.resolve({ data: [] as Array<{ employer_id: string; amount: number | null; created_at: string }> }),
  ]);

  const employeesByEmployer = new Map<string, { count: number; payroll: number }>();
  (employeesResult.data ?? []).forEach((employee) => {
    const curr = employeesByEmployer.get(employee.employer_id) ?? { count: 0, payroll: 0 };
    const active = employee.status === 'active';
    employeesByEmployer.set(employee.employer_id, {
      count: curr.count + (active ? 1 : 0),
      payroll: curr.payroll + (active ? employee.monthly_salary ?? 0 : 0),
    });
  });

  const advancesByEmployer = new Map<string, number>();
  (advancesResult.data ?? []).forEach((advance) => {
    advancesByEmployer.set(
      advance.employer_id,
      (advancesByEmployer.get(advance.employer_id) ?? 0) + (advance.amount ?? 0)
    );
  });

  const result = (onboardingRows ?? []).map((row) => {
    const employeeMeta = employeesByEmployer.get(row.id) ?? { count: 0, payroll: 0 };
    const riskFactors = riskFactorsByEmployer.get(row.id);
    
    let riskScore = Number(row.risk_score ?? 0);
    let riskRating = row.risk_rating;
    
    if (riskFactors) {
      riskScore = calculateCompositeRiskScore(riskFactors);
      riskRating = getRiskRating(riskScore);
    } else if (!riskScore || riskScore === 0) {
      riskScore = 3.0;
      riskRating = 'B';
    }

    const applicationFee = calculateApplicationFee(riskScore);

    return {
      id: row.id,
      company_name: row.company_name ?? 'Unknown company',
      employer_code: codesByUserId.get(row.user_id) || `EW-${row.id.slice(0, 8).toUpperCase()}`,
      industry: row.industry ?? '',
      sector: row.sector ?? '',
      country: row.country ?? '',
      registration_number: row.registration_number ?? null,
      tax_id: row.tax_id ?? null,
      address: row.physical_address ?? null,
      contact_person: row.contact_person ?? null,
      contact_email: row.contact_email ?? '',
      contact_phone: row.contact_phone ?? null,
      payroll_cycle: row.payroll_cycle ?? null,
      status: toAdminStatus(row.status),
      
      risk_score: riskScore,
      risk_rating: riskRating ?? 'B',
      application_fee: applicationFee,
      risk_scored_at: riskFactors?.scored_at ?? null,
      has_risk_factors: !!riskFactors,
      
      created_at: row.created_at,
      updated_at: row.updated_at ?? row.created_at,
      employee_count: employeeMeta.count,
      total_advances: advancesByEmployer.get(row.id) ?? 0,
      monthly_payroll: employeeMeta.payroll,
    };
  });
  
  const updatedEmployers = result.filter(row => {
    const currentRiskFactors = riskFactorsByEmployer.get(row.id);
    const previousRiskScore = Number(row.risk_score ?? 0);
    const newRiskScore = row.risk_score;
    
    return currentRiskFactors && previousRiskScore !== newRiskScore;
  });

  if (updatedEmployers.length > 0) {
    await Promise.all(
      updatedEmployers.map(employer => 
        pusherServer.trigger(`employer-${employer.id}`, 'risk-updated', {
          type: 'risk_score_updated',
          risk_score: employer.risk_score,
          risk_rating: employer.risk_rating,
          updated_at: new Date().toISOString()
        })
      )
    );
  }

  const countries = [...new Set(result.map((e) => e.country).filter(Boolean))].sort();
  const industries = [...new Set(result.map((e) => e.industry).filter(Boolean))].sort();

  const stats = {
    total: result.length,
    active: result.filter((e) => e.status === 'approved').length,
    pending: result.filter((e) => e.status === 'pending' || e.status === 'submitted').length,
    risk_review: result.filter((e) => e.status === 'risk_review_in_progress').length,
    suspended: result.filter((e) => e.status === 'suspended').length,
    rejected: result.filter((e) => e.status === 'rejected').length,
    total_employees: result.reduce((sum, e) => sum + e.employee_count, 0),
    
    risk_distribution: {
      low_risk: result.filter((e) => e.risk_rating === 'A').length,
      medium_risk: result.filter((e) => e.risk_rating === 'B').length,
      high_risk: result.filter((e) => e.risk_rating === 'C').length,
      very_high_risk: result.filter((e) => e.risk_rating === 'D').length,
    },
    
    avg_risk_score: result.length > 0 
      ? result.reduce((sum, e) => sum + e.risk_score, 0) / result.length 
      : 0,
    avg_application_fee: result.length > 0
      ? result.reduce((sum, e) => sum + e.application_fee, 0) / result.length
      : 0,
    
    needs_risk_assessment: result.filter((e) => !e.has_risk_factors || e.status === 'risk_review_in_progress').length,

    base_currency: countryFilter ? (countries.find(c => c === countryFilter) || 'KES') : 'KES',
  };

  const filtered = result.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (countryFilter && e.country !== countryFilter) return false;
    if (riskRatingFilter && e.risk_rating !== riskRatingFilter) return false;
    if (searchFilter) {
      return (
        e.company_name.toLowerCase().includes(searchFilter) ||
        e.contact_email.toLowerCase().includes(searchFilter) ||
        (e.contact_person ?? '').toLowerCase().includes(searchFilter) ||
        (e.industry ?? '').toLowerCase().includes(searchFilter)
      );
    }
    return true;
  });

  return NextResponse.json(
    {
      data: filtered,
      stats,
      filters: {
        countries,
        industries,
        risk_ratings: ['A', 'B', 'C', 'D'],
        statuses: ['approved', 'pending', 'rejected', 'suspended', 'risk_review_in_progress'],
      },
      framework: {
        version: 'REV1',
        date: '2025-10-25',
        base_fee: 3.5,
        risk_factor: 3.0,
      },
    },
    { status: 200, headers: rateResult.headers }
  );
}




