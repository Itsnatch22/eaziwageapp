
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { isAdminRole } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminEmployerStatus = 'approved' | 'pending' | 'rejected' | 'suspended';

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

// ─── Framework Constants (from PDF) ───────────────────────────────────────────

const CATEGORY_WEIGHTS = {
  legal_compliance:  0.20,  // 20%
  financial_health:  0.35,  // 35% (core risk driver)
  operational:       0.20,  // 20%
  sector_exposure:   0.15,  // 15%
  aml_transparency:  0.10,  // 10%
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

// ─── Helper Functions ─────────────────────────────────────────────────────────

function toAdminStatus(status: string | null | undefined): AdminEmployerStatus {
  if (status === 'approved' || status === 'rejected' || status === 'suspended') return status;
  return 'pending';
}

/**
 * Calculate Composite Risk Score (CRS) using weighted formula from PDF:
 * CRS_employer = Σ(Score_i × Weight_i) / Σ Weight_i
 */
function calculateCompositeRiskScore(rf: Partial<RiskFactors>): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Legal & Compliance (20%)
  totalWeightedScore += (rf.registration_status ?? 3) * SUB_FACTOR_WEIGHTS.legal_compliance.registration_status;
  totalWeightedScore += (rf.tax_compliance ?? 3) * SUB_FACTOR_WEIGHTS.legal_compliance.tax_compliance;
  totalWeightedScore += (rf.ewa_agreement ?? 3) * SUB_FACTOR_WEIGHTS.legal_compliance.ewa_agreement;
  totalWeight += CATEGORY_WEIGHTS.legal_compliance;

  // Financial Health (35% - core risk driver)
  totalWeightedScore += (rf.audited_financials ?? 3) * SUB_FACTOR_WEIGHTS.financial_health.audited_financials;
  totalWeightedScore += (rf.liquidity_ratio ?? 3) * SUB_FACTOR_WEIGHTS.financial_health.liquidity_ratio;
  totalWeightedScore += (rf.payroll_sustainability ?? 3) * SUB_FACTOR_WEIGHTS.financial_health.payroll_sustainability;
  totalWeight += CATEGORY_WEIGHTS.financial_health;

  // Operational Dynamics (20%)
  totalWeightedScore += (rf.employee_count ?? 3) * SUB_FACTOR_WEIGHTS.operational.employee_count;
  totalWeightedScore += (rf.churn_rate ?? 3) * SUB_FACTOR_WEIGHTS.operational.churn_rate;
  totalWeightedScore += (rf.payroll_integration ?? 3) * SUB_FACTOR_WEIGHTS.operational.payroll_integration;
  totalWeight += CATEGORY_WEIGHTS.operational;

  // Sector & Regulatory (15%)
  totalWeightedScore += (rf.industry_risk ?? 3) * SUB_FACTOR_WEIGHTS.sector_exposure.industry_risk;
  totalWeightedScore += (rf.regulatory_exposure ?? 3) * SUB_FACTOR_WEIGHTS.sector_exposure.regulatory_exposure;
  totalWeight += CATEGORY_WEIGHTS.sector_exposure;

  // AML / Ownership (10%)
  totalWeightedScore += (rf.beneficial_ownership ?? 3) * SUB_FACTOR_WEIGHTS.aml_transparency.beneficial_ownership;
  totalWeightedScore += (rf.pep_screening ?? 3) * SUB_FACTOR_WEIGHTS.aml_transparency.pep_screening;
  totalWeight += CATEGORY_WEIGHTS.aml_transparency;

  const crs = totalWeightedScore / totalWeight;
  return Math.max(0, Math.min(5, crs));
}

/**
 * Determine risk rating based on CRS thresholds from PDF Table 6:
 * A: 4.0–5.0 (Low Risk)
 * B: 3.0–3.9 (Medium Risk)
 * C: 2.6–2.9 (High Risk)
 * D: 0.0–2.5 (Very High Risk)
 */
function getRiskRating(crs: number): 'A' | 'B' | 'C' | 'D' {
  if (crs >= 4.0) return 'A';
  if (crs >= 3.0) return 'B';
  if (crs >= 2.6) return 'C';
  return 'D';
}

/**
 * Calculate application fee using formula from PDF Section 4:
 * Application Fee (%) = Bf + (Rf × (1 - CRS_total/5))
 * where Bf = 3.5% (Base Service Fee)
 * and   Rf = 3.0% (Risk Adjustment Factor)
 */
function calculateApplicationFee(crs: number): number {
  const BASE_FEE = 3.5;
  const RISK_FACTOR = 3.0;
  return BASE_FEE + (RISK_FACTOR * (1 - crs / 5));
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

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

  // ── Verify Admin Role ─────────────────────────────────────────────────────
  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>();

  if (profileError) {
    return NextResponse.json(
      { error: 'Failed to verify role.', code: 'ROLE_CHECK_FAILED' },
      { status: 500, headers: rateResult.headers }
    );
  }

  const roleCandidates = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.toLowerCase());

  console.log('[DEBUG /api/admin/employers] user.id:', user.id, '| roleCandidates:', roleCandidates);
  if (!roleCandidates.some((r) => isAdminRole(r as any))) {
    console.warn('[/api/admin/employers] FORBIDDEN — roleCandidates did not pass isAdminRole. Values:', roleCandidates);
    return NextResponse.json(
      {
        error: 'Forbidden. Admin access required.',
        code: 'FORBIDDEN',
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            found_roles: roleCandidates,
            allowed_roles: ['admin', 'super_admin', 'compliance', 'employer_admin'],
            hint: 'Update the profiles.role column in Supabase for this user to one of the allowed_roles values.',
          },
        }),
      },
      { status: 403, headers: rateResult.headers }
    );
  }

  // ── Parse Query Parameters ────────────────────────────────────────────────
  const searchParams = req.nextUrl.searchParams;
  const statusFilter = searchParams.get('status')?.trim() ?? '';
  const countryFilter = searchParams.get('country')?.trim() ?? '';
  const riskRatingFilter = searchParams.get('risk_rating')?.trim() ?? '';
  const searchFilter = searchParams.get('search')?.trim().toLowerCase() ?? '';

  // ── Fetch Employers ───────────────────────────────────────────────────────
  const { data: onboardingRows, error } = await adminSupabase
    .from('employer_onboarding')
    .select(
      `
      id,
      user_id,
      company_name,
      company_code,
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
    `
    )
    .in('status', ['submitted', 'approved', 'rejected', 'suspended'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GET /api/admin/employers] Supabase error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employers.', code: 'SERVER_ERROR' },
      { status: 500, headers: rateResult.headers }
    );
  }

  const employerIds = (onboardingRows ?? []).map((row) => row.id);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // ── Fetch Risk Factors for All Employers ──────────────────────────────────
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

  // Map risk factors by employer_id
  const riskFactorsByEmployer = new Map<string, any>();
  (riskFactorsData ?? []).forEach((rf) => {
    riskFactorsByEmployer.set(rf.employer_id, rf);
  });

  // ── Fetch Employee & Advance Data ─────────────────────────────────────────
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

  // ── Build Result with Risk Scoring ────────────────────────────────────────
  const result = (onboardingRows ?? []).map((row) => {
    const employeeMeta = employeesByEmployer.get(row.id) ?? { count: 0, payroll: 0 };
    const riskFactors = riskFactorsByEmployer.get(row.id);
    
    // Calculate or use existing risk score
    let riskScore = Number(row.risk_score ?? 0);
    let riskRating = row.risk_rating;
    
    if (riskFactors) {
      // Recalculate if factors are available
      riskScore = calculateCompositeRiskScore(riskFactors);
      riskRating = getRiskRating(riskScore);
    } else if (!riskScore || riskScore === 0) {
      // Default for new employers without factors
      riskScore = 3.0;
      riskRating = 'B';
    }

    // Calculate application fee based on risk score
    const applicationFee = calculateApplicationFee(riskScore);

    return {
      id: row.id,
      company_name: row.company_name ?? 'Unknown company',
      employer_code: row.company_code ?? `EMP-${row.id.slice(0, 8).toUpperCase()}`,
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
      
      // Risk Scoring (Framework Compliant)
      risk_score: riskScore,
      risk_rating: riskRating ?? 'B',
      application_fee: applicationFee,
      risk_scored_at: riskFactors?.scored_at ?? null,
      has_risk_factors: !!riskFactors,
      
      // Operational Metrics
      created_at: row.created_at,
      updated_at: row.updated_at ?? row.created_at,
      employee_count: employeeMeta.count,
      total_advances: advancesByEmployer.get(row.id) ?? 0,
      monthly_payroll: employeeMeta.payroll,
    };
  });

  // ── Calculate Statistics ──────────────────────────────────────────────────
  const stats = {
    total: result.length,
    active: result.filter((e) => e.status === 'approved').length,
    pending: result.filter((e) => e.status === 'pending').length,
    suspended: result.filter((e) => e.status === 'suspended').length,
    rejected: result.filter((e) => e.status === 'rejected').length,
    total_employees: result.reduce((sum, e) => sum + e.employee_count, 0),
    
    // Risk Distribution
    risk_distribution: {
      low_risk: result.filter((e) => e.risk_rating === 'A').length,
      medium_risk: result.filter((e) => e.risk_rating === 'B').length,
      high_risk: result.filter((e) => e.risk_rating === 'C').length,
      very_high_risk: result.filter((e) => e.risk_rating === 'D').length,
    },
    
    // Average Metrics
    avg_risk_score: result.length > 0 
      ? result.reduce((sum, e) => sum + e.risk_score, 0) / result.length 
      : 0,
    avg_application_fee: result.length > 0
      ? result.reduce((sum, e) => sum + e.application_fee, 0) / result.length
      : 0,
    
    // Employers needing risk assessment
    needs_risk_assessment: result.filter((e) => !e.has_risk_factors).length,
  };

  const countries = [...new Set(result.map((e) => e.country).filter(Boolean))].sort();
  const industries = [...new Set(result.map((e) => e.industry).filter(Boolean))].sort();

  // ── Apply Filters ─────────────────────────────────────────────────────────
  const filtered = result.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (countryFilter && e.country !== countryFilter) return false;
    if (riskRatingFilter && e.risk_rating !== riskRatingFilter) return false;
    if (searchFilter) {
      return (
        e.company_name.toLowerCase().includes(searchFilter) ||
        e.contact_email.toLowerCase().includes(searchFilter) ||
        e.employer_code.toLowerCase().includes(searchFilter) ||
        (e.contact_person ?? '').toLowerCase().includes(searchFilter) ||
        (e.industry ?? '').toLowerCase().includes(searchFilter)
      );
    }
    return true;
  });

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      data: filtered,
      stats,
      filters: {
        countries,
        industries,
        risk_ratings: ['A', 'B', 'C', 'D'],
        statuses: ['approved', 'pending', 'rejected', 'suspended'],
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