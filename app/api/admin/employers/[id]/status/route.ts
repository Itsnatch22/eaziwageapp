// app/api/admin/employers/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';

type AdminEmployerStatus = 'verified' | 'pending' | 'rejected' | 'suspended' | 'risk_review_in_progress';

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

  if (!roleCandidates.some((r) => {
    const parsed = UserRoleEnum.safeParse(r);
    return parsed.success && isAdminRole(parsed.data);
  })) {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.', code: 'FORBIDDEN' },
      { status: 403, headers: rateResult.headers }
    );
  }

  const { status: newStatus } = (await req.json()) as { status: AdminEmployerStatus };

if (!['approved', 'pending', 'rejected', 'suspended', 'risk_review_in_progress'].includes(newStatus)) {
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

  // Handle 'approved' status logic
  if (newStatus === 'verified') {
    const {
      user_id,
      company_name,
      industry,
      country,
      registration_number,
      tax_id,
      physical_address,
      city,
      postal_code,
      county_region,
      contact_person,
      contact_email,
      contact_phone,
      payroll_cycle,
      risk_score,
    } = onboardingRecord;

    // Fetch employer code from profiles
    const { data: userProfile } = await adminSupabase
        .from('profiles')
        .select('company_code')
        .eq('id', user_id)
        .single();
    
    const employerCode = userProfile?.company_code || `EW-${id.slice(0, 8).toUpperCase()}`;

    // Use upsert to allow re-approval/updating existing record
    const { error: upsertError } = await adminSupabase.from('employers').upsert([
      {
        id,
        user_id,
        employer_code: employerCode,
        company_name,
        industry,
        country,
        registration_number,
        tax_id,
        address: physical_address,
        city,
        postal_code,
        county_region,
        contact_person,
        contact_email,
        contact_phone,
        payroll_cycle,
        status: 'approved',
        risk_score: risk_score || onboardingRecord.risk_score || 0,
        updated_at: new Date().toISOString()
      },
    ], { onConflict: 'id' });

    if (upsertError) {
      console.error('[status] Upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to sync employer record.' }, { status: 500 });
    }
  } else if ((onboardingRecord.status as string) === 'approved' && newStatus !== 'verified') {
    // If it was approved and now it's something else, we might want to remove it from the 'employers' table 
    // or update its status there too. Usually 'employers' table contains active/active-ish ones.
    // For now, let's just keep the status in sync in the employers table if it exists.
    const { error: syncError } = await adminSupabase
        .from('employers')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
    
    if (syncError) {
        console.warn('[status] Sync warning:', syncError.message);
    }
  }

  return NextResponse.json({ message: `Employer status updated to ${newStatus} successfully.` });
}
