import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import pusherServer from '@/lib/pusher-server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: docId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const notes = searchParams.get('notes') || '';

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-kyc-review:${ip}`);

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = getEnv();
  const adminSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify Admin
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !isAdminRole(UserRoleEnum.parse(profile.role.toLowerCase()))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['approved', 'rejected'].includes(status || '')) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // 1. Update the document status and get document owner context
  const { data: reviewedDoc, error: updateError } = await adminSupabase
    .from('employee_kyc_documents')
    .update({ 
      status, 
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id
    })
    .select('id,user_id,document_type,status')
    .eq('id', docId);

  if (updateError || !reviewedDoc || reviewedDoc.length === 0) {
    console.error('[KYC Review] Update error:', updateError);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }

  const doc = reviewedDoc[0];

  // 2. Recompute onboarding status based on all submitted docs for this user
  const { data: docsForUser, error: docsError } = await adminSupabase
    .from('employee_kyc_documents')
    .select('status')
    .eq('user_id', doc.user_id);

  if (docsError) {
    console.error('[KYC Review] Failed to fetch user docs:', docsError);
    return NextResponse.json({ error: 'Failed to finalize KYC review' }, { status: 500 });
  }

  const totalDocs = docsForUser?.length ?? 0;
  const hasRejected = (docsForUser ?? []).some((d) => d.status === 'rejected');
  const allApproved = totalDocs > 0 && (docsForUser ?? []).every((d) => d.status === 'approved');

  let onboardingStatus: 'approved' | 'rejected' | 'pending' = 'pending';
  if (hasRejected) onboardingStatus = 'rejected';
  else if (allApproved) onboardingStatus = 'approved';

  const { data: employeeOnboarding, error: employeeError } = await adminSupabase
    .from('employee_onboarding')
    .update({
      status: onboardingStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', doc.user_id)
    .select('id,employer_id,monthly_salary')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employeeError) {
    console.error('[KYC Review] Failed to sync employee onboarding status:', employeeError);
    return NextResponse.json({ error: 'Failed to sync employee status' }, { status: 500 });
  }

  // 3. On full approval, bootstrap default EWA settings (initial credit limit)
  if (onboardingStatus === 'approved' && employeeOnboarding?.id && employeeOnboarding?.employer_id) {
    const monthlySalary = Number(employeeOnboarding.monthly_salary ?? 0);
    const initialLimit = Math.max(5000, Math.round(monthlySalary * 0.5) || 5000);

    const { error: ewaError } = await adminSupabase
      .from('employee_ewa_settings')
      .upsert(
        {
          employee_onboarding_id: employeeOnboarding.id,
          employer_id: employeeOnboarding.employer_id,
          ewa_enabled: true,
          max_advance_percentage: 50,
          min_advance_amount: 500,
          max_advance_amount: initialLimit,
          cooldown_period: 7,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_onboarding_id' }
      );

    if (ewaError) {
      console.error('[KYC Review] Failed to initialize EWA settings:', ewaError);
    }
  }

  // 4. Notify employee
  const employeeMessage =
    onboardingStatus === 'approved'
      ? 'Your KYC has been fully approved and your account is now active.'
      : onboardingStatus === 'rejected'
      ? `One or more KYC documents were rejected. ${notes ? `Reason: ${notes}` : ''}`.trim()
      : `Your ${doc.document_type.replace(/_/g, ' ')} document was ${status}.`;

  await adminSupabase.from('notifications').insert({
    user_id: doc.user_id,
    type: 'kyc_update',
    title: onboardingStatus === 'approved' ? 'KYC Approved' : onboardingStatus === 'rejected' ? 'KYC Requires Action' : 'KYC Document Reviewed',
    message: employeeMessage,
    read: false,
    created_at: new Date().toISOString(),
  });

  // ── 5. Trigger Pusher for dynamic updates ────────────────────────────────────
  try {
    // Notify the employee
    await pusherServer.trigger(`user-${doc.user_id}`, 'kyc-update', {
      document_id: doc.id,
      status,
      onboarding_status: onboardingStatus,
      message: employeeMessage
    });

    // If we have an employer_id, notify the employer's channel too
    if (employeeOnboarding?.employer_id) {
      await pusherServer.trigger(`employer-${employeeOnboarding.employer_id}`, 'employee-kyc-update', {
        employee_user_id: doc.user_id,
        onboarding_status: onboardingStatus
      });
    }
  } catch (pusherErr) {
    console.error('[KYC Review] Pusher trigger error:', pusherErr);
  }

  return NextResponse.json({
    message: 'Document reviewed successfully',
    data: {
      document_id: doc.id,
      status,
      onboarding_status: onboardingStatus,
    },
  });
}
