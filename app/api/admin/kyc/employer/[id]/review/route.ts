import { NextRequest, NextResponse } from 'next/server';
import { adminApiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { notifyEmployer } from '@/lib/notifications';

const ONBOARDING_FIELDS = 'id, user_id, company_name, status';

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  const { id: appId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const notes = searchParams.get('notes') || '';

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(adminApiLimiter, `admin-employer-kyc-review:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { user, adminSupabase } = auth;

  if (!['approved', 'rejected'].includes(status || '')) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (status === 'rejected' && !notes.trim()) {
    return NextResponse.json({ error: 'A reason is required when rejecting an application.' }, { status: 422 });
  }

  const { data: onboardingRow, error: fetchError } = await adminSupabase
    .from('employer_onboarding')
    .select('id, user_id')
    .eq('id', appId)
    .maybeSingle();

  if (fetchError || !onboardingRow) {
    return NextResponse.json({ error: 'Employer onboarding record not found' }, { status: 404 });
  }

  // Bulk review of every submitted document — a convenience action for
  // reviewing the whole application at once, not a "reject/approve the whole
  // thing regardless of documents" override. This only ever touches documents
  // that actually exist (an employer who hasn't submitted all 11 yet can't be
  // force-approved — there's nothing here to set to 'approved'), and firing
  // trg_recompute_employer_onboarding_status is what actually derives
  // employer_onboarding.status; this route no longer writes it directly.
  const { error: docsError } = await adminSupabase
    .from('employer_kyc_documents')
    .update({
      status,
      ...(status === 'rejected' ? { reviewer_notes: notes } : {}),
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('user_id', onboardingRow.user_id);

  if (docsError) {
    console.error('[Employer KYC Review] Bulk document update error:', docsError);
    return NextResponse.json({ error: 'Failed to update employer documents' }, { status: 500 });
  }

  const { data: employer, error: onboardingError } = await adminSupabase
    .from('employer_onboarding')
    .select(ONBOARDING_FIELDS)
    .eq('id', appId)
    .maybeSingle();

  if (onboardingError || !employer) {
    console.error('[Employer KYC Review] Failed to re-fetch onboarding record:', onboardingError);
    return NextResponse.json({ error: 'Failed to finalize KYC review' }, { status: 500 });
  }

  // The actual, trigger-derived outcome — may differ from the requested
  // `status` (e.g. requesting 'approved' when not all 11 documents exist yet
  // leaves the real status at 'submitted'/'under_review', since there's
  // nothing to bulk-approve for the missing ones).
  const resultStatus = employer.status;

  // KYC document review is its own gate, independent of account approval —
  // this route must never grant or revoke dashboard access (profiles.is_active)
  // as a side effect of a review outcome. Promotion to the live `employers`
  // table and dashboard-access activation happen exclusively via an admin's
  // explicit account-approval action in
  // app/api/admin/employers/[id]/status/route.ts.

  await notifyEmployer({
    userId: employer.user_id,
    type: 'kyc_update',
    title: resultStatus === 'approved' ? 'KYC Review Complete' : resultStatus === 'rejected' ? 'Employer Onboarding Rejected' : 'Employer Onboarding Reviewed',
    message:
      resultStatus === 'approved'
        ? `${employer.company_name}'s KYC documents have all been reviewed and approved. An admin will review your account for final approval.`
        : resultStatus === 'rejected'
        ? `Your onboarding submission was rejected.${notes ? ` Reason: ${notes}` : ''}`
        : `Your onboarding documents were reviewed. Current status: ${resultStatus}.`,
  });

  // Audit trail — record every KYC decision with reviewer identity and reason
  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email ?? user.id,
    target_id: appId,
    target_type: 'employer_onboarding',
    action: `kyc_${status}`,
    new_value: { requested_status: status, result_status: resultStatus, notes: notes || null },
    metadata: { company_name: employer.company_name },
  });

  return NextResponse.json({
    message: 'Employer review submitted successfully',
    data: {
      employer_id: employer.id,
      status: resultStatus,
    },
  });
}
