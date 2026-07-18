import { NextRequest, NextResponse } from 'next/server';

import { adminApiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getEnv } from '@/env';

type AdminEmployerStatus = 'approved' | 'pending' | 'rejected' | 'suspended' | 'risk_review_in_progress';

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

function toAdminStatus(status: string | null | undefined): AdminEmployerStatus {
  if (status === 'approved' || status === 'rejected' || status === 'suspended' || status === 'risk_review_in_progress') return status;
  return 'pending';
}

export async function GET(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  const { id } = await params;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(adminApiLimiter, `admin-employer-detail:${ip}`);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase } = auth;

  const { data: employer, error } = await adminSupabase
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
      bank_name,
      bank_account_number,
      created_at,
      updated_at
    `)
    .eq('id', id)
    .single();

  if (error || !employer) {
    return NextResponse.json(
      { error: 'Employer not found.', code: 'NOT_FOUND' },
      { status: 404, headers: rateResult.headers }
    );
  }

  let decryptedBankAccount: string | null = null;
  const hasBankAccount = Boolean(employer.bank_account_number);
  if (hasBankAccount) {
    try {
      const { PII_ENCRYPTION_KEY } = getEnv();
      if (PII_ENCRYPTION_KEY) {
        const { data: dec } = await adminSupabase.rpc('admin_get_employer_bank_account', {
          p_onboarding_id: id,
          p_key: PII_ENCRYPTION_KEY,
        });
        decryptedBankAccount = dec ?? null;
      } else {
        // Key not configured — signal that data exists but can't be shown
        decryptedBankAccount = '[Encrypted]';
      }
    } catch {
      decryptedBankAccount = '[Encrypted]';
    }
  }

  const { data: profileRow } = await adminSupabase
    .from('profiles')
    .select('company_code')
    .eq('id', employer.user_id)
    .maybeSingle();

  const { data: liveEmployer } = await adminSupabase
    .from('employers')
    .select('id, employer_code')
    .eq('onboarding_id', id)
    .maybeSingle();

  const employerCode = liveEmployer?.employer_code || profileRow?.company_code || `EW-${employer.id.slice(0, 8).toUpperCase()}`;

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [employeeResult, advancesResult] = await Promise.all([
    liveEmployer?.id
      ? adminSupabase
          .from('employees')
          .select('monthly_salary,status')
          .eq('employer_id', liveEmployer.id)
      : Promise.resolve({ data: [] as Array<{ monthly_salary: number | null; status: string | null }> }),
    adminSupabase
      .from('advances')
      .select('amount')
      .eq('employer_id', id)
      .gte('created_at', startOfMonth),
  ]);

  const activeEmployees = (employeeResult.data ?? []).filter((e) => e.status?.toLowerCase() === 'active');
  const employeeCount = employeeResult.data?.length ?? 0;
  const monthlyPayroll = activeEmployees.reduce((sum, e) => sum + (e.monthly_salary ?? 0), 0);
  const totalAdvances = (advancesResult.data ?? []).reduce((sum, a) => sum + (a.amount ?? 0), 0);

  return NextResponse.json(
    {
      id: employer.id,
      company_name: employer.company_name ?? 'Unknown company',
      employer_code: employerCode,
      industry: employer.industry ?? '',
      country: employer.country ?? '',
      registration_number: employer.registration_number ?? null,
      tax_id: employer.tax_id ?? null,
      address: employer.physical_address ?? null,
      contact_person: employer.contact_person ?? null,
      contact_email: employer.contact_email ?? '',
      contact_phone: employer.contact_phone ?? null,
      payroll_cycle: employer.payroll_cycle ?? null,
      status: toAdminStatus(employer.status),
      risk_score: employer.risk_score ?? null,
      bank_name: employer.bank_name || null,
      bank_account_number: decryptedBankAccount,
      created_at: employer.created_at,
      updated_at: employer.updated_at ?? employer.created_at,
      employee_count: employeeCount,
      total_advances: totalAdvances,
      monthly_payroll: monthlyPayroll,
    },
    { status: 200, headers: rateResult.headers }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(adminApiLimiter, `admin-employer-patch:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase, user } = auth;

  const body = await req.json();
  const {
    risk_score,
    risk_rating,
    risk_factors,
    override_reason,
  } = body as {
    risk_score?: number;
    risk_rating?: 'A' | 'B' | 'C' | 'D';
    risk_factors?: Partial<RiskFactors>;
    override_reason?: string;
  };

  const onboardingUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof risk_score === 'number') onboardingUpdate.risk_score = risk_score;
  if (typeof risk_rating === 'string') onboardingUpdate.risk_rating = risk_rating;

  const { data: targetEmployer, error: fetchEmployerError } = await adminSupabase
    .from('employer_onboarding')
    .select('id,user_id,company_name')
    .eq('id', id)
    .maybeSingle();

  if (fetchEmployerError || !targetEmployer) {
    return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
  }

  const { error: updateError } = await adminSupabase
    .from('employer_onboarding')
    .update(onboardingUpdate)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  if (risk_factors && typeof risk_factors === 'object') {
    const riskFactorPayload = {
      employer_id: id,
      registration_status: risk_factors.registration_status ?? null,
      tax_compliance: risk_factors.tax_compliance ?? null,
      ewa_agreement: risk_factors.ewa_agreement ?? null,
      audited_financials: risk_factors.audited_financials ?? null,
      liquidity_ratio: risk_factors.liquidity_ratio ?? null,
      payroll_sustainability: risk_factors.payroll_sustainability ?? null,
      employee_count: risk_factors.employee_count ?? null,
      churn_rate: risk_factors.churn_rate ?? null,
      payroll_integration: risk_factors.payroll_integration ?? null,
      industry_risk: risk_factors.industry_risk ?? null,
      regulatory_exposure: risk_factors.regulatory_exposure ?? null,
      beneficial_ownership: risk_factors.beneficial_ownership ?? null,
      pep_screening: risk_factors.pep_screening ?? null,
      composite_score: typeof risk_score === 'number' ? risk_score : null,
      scored_at: new Date().toISOString(),
    };

    const { error: factorsError } = await adminSupabase
      .from('employer_risk_factors')
      .upsert(riskFactorPayload, { onConflict: 'employer_id' });

    if (factorsError) {
      console.error('[PATCH /api/admin/employers/:id] Failed to save risk factors:', factorsError);
    }
  }

  await adminSupabase.from('notifications').insert({
    user_id: targetEmployer.user_id,
    type: 'system',
    title: 'Risk Profile Updated',
    message: override_reason?.trim()
      ? `Your employer risk profile was updated by admin. Note: ${override_reason.trim()}`
      : 'Your employer risk profile was updated by admin.',
    read: false,
    created_at: new Date().toISOString(),
  });

  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email,
    target_id: id,
    target_type: 'employer',
    action: 'employer_risk_updated',
    old_value: null,
    new_value: { risk_score, risk_rating },
    metadata: { override_reason },
  }).then(({ error }) => { if (error) console.error('[audit] employer_risk_updated:', error); });

  return NextResponse.json({ message: 'Employer updated successfully' });
}
