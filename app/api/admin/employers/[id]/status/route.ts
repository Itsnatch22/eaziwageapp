// app/api/admin/employers/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { isAdminRole } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';

type AdminEmployerStatus = 'approved' | 'pending' | 'rejected' | 'suspended';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employer-status:${ip}`);

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

  // Verify Admin Role
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

  if (!roleCandidates.some((r) => isAdminRole(r as any))) {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.', code: 'FORBIDDEN' },
      { status: 403, headers: rateResult.headers }
    );
  }

  const { status: newStatus } = (await req.json()) as { status: AdminEmployerStatus };

  if (!['approved', 'pending', 'rejected', 'suspended'].includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status provided.' }, { status: 400 });
  }

  // Fetch the onboarding record
  const { data: onboardingRecord, error: fetchError } = await adminSupabase
    .from('employer_onboarding')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !onboardingRecord) {
    return NextResponse.json({ error: 'Employer not found.' }, { status: 404 });
  }

  // Update the status in employer_onboarding table
  const { error: updateError } = await adminSupabase
    .from('employer_onboarding')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update employer status.' }, { status: 500 });
  }

  // If approved, create a new record in the employers table
  if (newStatus === 'approved' && onboardingRecord.status !== 'approved') {
    const {
      company_name,
      company_code,
      industry,
      country,
      registration_number,
      tax_id,
      physical_address,
      contact_person,
      contact_email,
      contact_phone,
      payroll_cycle,
      risk_score,
    } = onboardingRecord;

    const { error: insertError } = await adminSupabase.from('employers').insert([
      {
        id,
        company_name,
        employer_code: company_code ?? `EMP-${id.slice(0, 8).toUpperCase()}`,
        industry,
        country,
        registration_number,
        tax_id,
        address: physical_address,
        contact_person,
        contact_email,
        contact_phone,
        payroll_cycle,
        status: 'approved',
        risk_score,
        employee_count: 0,
        total_advances: 0,
        monthly_payroll: 0,
      },
    ]);

    if (insertError) {
      // Rollback the status update if the insert fails
      await adminSupabase
        .from('employer_onboarding')
        .update({ status: onboardingRecord.status })
        .eq('id', id);
      return NextResponse.json({ error: 'Failed to create employer record.' }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Employer status updated successfully.' });
}
