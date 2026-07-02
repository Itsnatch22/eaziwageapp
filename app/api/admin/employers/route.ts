import { NextRequest, NextResponse } from 'next/server';

import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { convertToUSD, getCurrencyFromCountry } from '@/lib/utils';


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
      { status: 429, headers: rateResult.headers },
    );
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase } = auth;

  const searchParams   = req.nextUrl.searchParams;
  const statusFilter      = searchParams.get('status')?.trim()      ?? '';
  const countryFilter     = searchParams.get('country')?.trim()     ?? '';
  const riskRatingFilter  = searchParams.get('risk_rating')?.trim() ?? '';
  const searchFilter      = searchParams.get('search')?.trim()      ?? '';
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit')  ?? '25', 10) || 25));
  const page   = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
  const from   = page * limit;
  const to     = from + limit - 1;

  // 1. Lightweight stats query — full table, minimal columns, no filters
  //    Used for global counts, filter options, and risk distribution.
  //    Employer tables rarely exceed a few thousand rows so this stays cheap.
  const [statsResult, exchangeRatesResult, riskSettingsResult] = await Promise.all([
    adminSupabase
      .from('employer_onboarding')
      .select('id, status, country, industry, risk_rating'),
    // Cap exchange_rates — there are ~200 currencies; never fetch unbounded
    adminSupabase
      .from('exchange_rates')
      .select('currency_code, rate_to_usd')
      .limit(100),
    adminSupabase.from('global_settings').select('risk_settings').eq('id', 'default').maybeSingle(),
  ]);

  // Risk Settings tab (Admin Settings → Risk & Compliance) — the employer A/B/C
  // rating bands used by getRating() in RiskScoringClient.tsx. Defaults match
  // that component's previous hardcoded values.
  const riskSettings = (riskSettingsResult.data?.risk_settings as { employer_low_threshold?: number; employer_medium_threshold?: number } | null) ?? {};
  const framework = {
    version: 'REV1',
    date: '2025-10-25',
    base_fee: 3.5,
    risk_factor: 3.0,
    rating_thresholds: {
      low: riskSettings.employer_low_threshold ?? 4.0,
      medium: riskSettings.employer_medium_threshold ?? 3.0,
    },
  };

  const statsRows = statsResult.data ?? [];

  const countries  = [...new Set(statsRows.map((e) => e.country).filter(Boolean))].sort() as string[];
  const industries = [...new Set(statsRows.map((e) => e.industry).filter(Boolean))].sort() as string[];

  const stats = {
    total:        statsRows.length,
    active:       statsRows.filter((e) => toAdminStatus(e.status) === 'approved').length,
    pending:      statsRows.filter((e) => { const s = toAdminStatus(e.status); return s === 'pending'; }).length,
    risk_review:  statsRows.filter((e) => e.status === 'risk_review_in_progress').length,
    suspended:    statsRows.filter((e) => e.status === 'suspended').length,
    rejected:     statsRows.filter((e) => e.status === 'rejected').length,
    risk_distribution: {
      low_risk:       statsRows.filter((e) => e.risk_rating === 'A').length,
      medium_risk:    statsRows.filter((e) => e.risk_rating === 'B').length,
      high_risk:      statsRows.filter((e) => e.risk_rating === 'C').length,
      very_high_risk: statsRows.filter((e) => e.risk_rating === 'D').length,
    },
    needs_risk_assessment: statsRows.filter((e) => !e.risk_rating || e.status === 'risk_review_in_progress').length,
    base_currency: countryFilter ? 'KES' : 'KES',
  };

  const rates = (exchangeRatesResult.data ?? []).reduce((acc: Record<string, number>, rate) => {
    if (rate.currency_code) acc[rate.currency_code.toUpperCase()] = Number(rate.rate_to_usd ?? 0);
    return acc;
  }, {} as Record<string, number>);

  // 2. Paginated + filtered data query — DB-level WHERE clauses, no JS filtering
  let dataQuery = adminSupabase
    .from('employer_onboarding')
    .select(
      'id, user_id, company_name, industry, sector, country, registration_number, tax_id, physical_address, contact_person, contact_email, contact_phone, payroll_cycle, status, risk_score, risk_rating, created_at, updated_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (statusFilter)     dataQuery = dataQuery.eq('status', statusFilter);
  if (countryFilter)    dataQuery = dataQuery.eq('country', countryFilter);
  if (riskRatingFilter) dataQuery = dataQuery.eq('risk_rating', riskRatingFilter);
  if (searchFilter) {
    const s = searchFilter.replace(/%/g, '\\%').replace(/_/g, '\\_');
    dataQuery = dataQuery.or(
      `company_name.ilike.%${s}%,contact_email.ilike.%${s}%,contact_person.ilike.%${s}%,industry.ilike.%${s}%`,
    );
  }

  const { data: onboardingRows, error, count: filteredCount } = await dataQuery;

  if (error) {
    console.error('[GET /api/admin/employers] Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employers.', code: 'SERVER_ERROR' },
      { status: 500, headers: rateResult.headers },
    );
  }

  // 3. Enrich only the paginated page of employers
  const employerIds   = (onboardingRows ?? []).map((row) => row.id);
  const userIds       = (onboardingRows ?? []).map((row) => row.user_id).filter(Boolean);
  const startOfMonth  = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  if (employerIds.length === 0) {
    return NextResponse.json({
      data: [],
      stats,
      pagination: { total: filteredCount ?? 0, page, limit, hasMore: false },
      filters: { countries, industries, risk_ratings: ['A', 'B', 'C', 'D'], statuses: ['approved', 'pending', 'rejected', 'suspended', 'risk_review_in_progress'] },
      framework,
    }, { status: 200, headers: rateResult.headers });
  }

  const [profilesResult, riskFactorsResult, liveEmployersResult] = await Promise.all([
    adminSupabase.from('profiles').select('id, company_code').in('id', userIds),
    adminSupabase
      .from('employer_risk_factors')
      .select('employer_id, registration_status, tax_compliance, ewa_agreement, audited_financials, liquidity_ratio, payroll_sustainability, employee_count, churn_rate, payroll_integration, industry_risk, regulatory_exposure, beneficial_ownership, pep_screening, composite_score, scored_at')
      .in('employer_id', employerIds),
    adminSupabase.from('employers').select('id, onboarding_id').in('onboarding_id', employerIds),
  ]);

  const codesByUserId = new Map(profilesResult.data?.map((p) => [p.id, p.company_code]) ?? []);

  const riskFactorsByEmployer = new Map<string, RiskFactors & { employer_id: string; scored_at: string | null }>();
  (riskFactorsResult.data ?? []).forEach((rf) => {
    riskFactorsByEmployer.set(rf.employer_id, rf as RiskFactors & { employer_id: string; scored_at: string | null });
  });

  const liveEmployers = liveEmployersResult.data ?? [];
  const onboardingIdByLiveEmployerId = new Map(
    liveEmployers
      .filter((e): e is { id: string; onboarding_id: string } => Boolean(e.onboarding_id))
      .map((e) => [e.id, e.onboarding_id]),
  );
  const liveEmployerIds = liveEmployers.map((e) => e.id);

  const [employeesResult, advancesResult] = await Promise.all([
    liveEmployerIds.length
      ? adminSupabase.from('employees').select('employer_id, monthly_salary, status').in('employer_id', liveEmployerIds)
      : Promise.resolve({ data: [] as Array<{ employer_id: string; monthly_salary: number | null; status: string | null }> }),
    adminSupabase
      .from('advances')
      .select('employer_id, amount')
      .in('employer_id', employerIds)
      .gte('created_at', startOfMonth),
  ]);

  const employeesByEmployer = new Map<string, { count: number; payroll: number }>();
  (employeesResult.data ?? []).forEach((employee) => {
    const onboardingId = onboardingIdByLiveEmployerId.get(employee.employer_id);
    if (!onboardingId) return;
    const curr   = employeesByEmployer.get(onboardingId) ?? { count: 0, payroll: 0 };
    const active = employee.status?.toLowerCase() === 'active';
    employeesByEmployer.set(onboardingId, {
      count:   curr.count + 1,
      payroll: curr.payroll + (active ? employee.monthly_salary ?? 0 : 0),
    });
  });

  const advancesByEmployer = new Map<string, number>();
  (advancesResult.data ?? []).forEach((adv) => {
    advancesByEmployer.set(adv.employer_id, (advancesByEmployer.get(adv.employer_id) ?? 0) + (adv.amount ?? 0));
  });

  const result = (onboardingRows ?? []).map((row) => {
    const employeeMeta  = employeesByEmployer.get(row.id) ?? { count: 0, payroll: 0 };
    const riskFactors   = riskFactorsByEmployer.get(row.id);

    let riskScore  = Number(row.risk_score ?? 0);
    let riskRating = row.risk_rating;

    if (riskFactors) {
      riskScore  = calculateCompositeRiskScore(riskFactors);
      riskRating = getRiskRating(riskScore);
    } else if (!riskScore || riskScore === 0) {
      riskScore  = 3.0;
      riskRating = 'B';
    }

    const country         = row.country ?? '';
    const companyCurrency = getCurrencyFromCountry(country, 'KES');

    return {
      id:                  row.id,
      company_name:        row.company_name ?? 'Unknown company',
      employer_code:       codesByUserId.get(row.user_id) || `EW-${row.id.slice(0, 8).toUpperCase()}`,
      industry:            row.industry ?? '',
      sector:              row.sector ?? '',
      country,
      registration_number: row.registration_number ?? null,
      tax_id:              row.tax_id ?? null,
      address:             row.physical_address ?? null,
      contact_person:      row.contact_person ?? null,
      contact_email:       row.contact_email ?? '',
      contact_phone:       row.contact_phone ?? null,
      payroll_cycle:       row.payroll_cycle ?? null,
      status:              toAdminStatus(row.status),
      risk_score:          riskScore,
      risk_rating:         riskRating ?? 'B',
      application_fee:     calculateApplicationFee(riskScore),
      risk_scored_at:      riskFactors?.scored_at ?? null,
      has_risk_factors:    !!riskFactors,
      created_at:          row.created_at,
      updated_at:          row.updated_at ?? row.created_at,
      employee_count:      employeeMeta.count,
      total_advances:      convertToUSD(advancesByEmployer.get(row.id) ?? 0, companyCurrency, rates),
      monthly_payroll:     convertToUSD(employeeMeta.payroll, companyCurrency, rates),
    };
  });

  // avg stats derived from the current page only (good enough for dashboard display)
  const pageStats = {
    avg_risk_score:    result.length > 0 ? result.reduce((s, e) => s + e.risk_score, 0) / result.length : 0,
    avg_application_fee: result.length > 0 ? result.reduce((s, e) => s + e.application_fee, 0) / result.length : 0,
    total_employees:   result.reduce((s, e) => s + e.employee_count, 0),
  };

  return NextResponse.json(
    {
      data:  result,
      stats: { ...stats, ...pageStats },
      pagination: {
        total:   filteredCount ?? 0,
        page,
        limit,
        hasMore: (filteredCount ?? 0) > from + result.length,
      },
      filters: {
        countries,
        industries,
        risk_ratings: ['A', 'B', 'C', 'D'],
        statuses: ['approved', 'pending', 'rejected', 'suspended', 'risk_review_in_progress'],
      },
      framework,
    },
    { status: 200, headers: rateResult.headers },
  );
}




