import { NextRequest, NextResponse } from 'next/server';
import { adminApiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { KycDocQuerySchema } from '@/lib/validations/route-schemas';
import { notifyEmployer } from '@/lib/notifications';

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  docId?: string;
  userId?: string;
  onboardingStatus?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, step: string, message: string, ctx: LogContext = {}, err?: unknown) {
  const entry = {
    level,
    route: 'PATCH /api/admin/kyc/employer/documents/[id]/review',
    step,
    message,
    ...ctx,
    ...(err !== undefined && {
      error: err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : err,
    }),
    ts: new Date().toISOString(),
  };

  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  const { id: docId } = await params;
  const { searchParams } = new URL(req.url);
  const queryParsed = KycDocQuerySchema.safeParse({
    status: searchParams.get('status'),
    notes: searchParams.get('notes') ?? undefined,
  });
  if (!queryParsed.success) {
    return NextResponse.json(
      { error: 'Invalid query params', issues: queryParsed.error.issues },
      { status: 422 },
    );
  }
  const { status, notes } = queryParsed.data;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(adminApiLimiter, `admin-employer-kyc-doc-review:${ip}`);

  if (!rateResult.success) {
    log('warn', 'rate_limit', 'Rate limit exceeded', { docId, ip });
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user, adminSupabase } = auth;

  const { data: reviewedDoc, error: updateError } = await adminSupabase
    .from('employer_kyc_documents')
    .update({
      status,
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .select('id,user_id,document_type,status')
    .eq('id', docId);

  if (updateError || !reviewedDoc || reviewedDoc.length === 0) {
    log('error', 'doc_update', 'Failed to update KYC document', { docId, userId: user.id, status }, updateError);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }

  const doc = reviewedDoc[0];
  log('info', 'doc_update', 'KYC document updated', { docId: doc.id, userId: doc.user_id, status });

  // trg_recompute_employer_onboarding_status already ran synchronously as part
  // of the update above (fires AFTER UPDATE OF status on employer_kyc_documents,
  // within the same statement/transaction) and set employer_onboarding.status
  // accordingly. Read that back rather than computing our own — matches the
  // pattern already established for the employee-side per-document route.
  const { data: onboarding, error: onboardingError } = await adminSupabase
    .from('employer_onboarding')
    .select('id, user_id, company_name, status')
    .eq('user_id', doc.user_id)
    .maybeSingle();

  if (onboardingError) {
    log('error', 'onboarding_sync', 'Failed to fetch employer onboarding status', {
      docId: doc.id,
      userId: doc.user_id,
    }, onboardingError);
    return NextResponse.json({ error: 'Failed to finalize KYC review' }, { status: 500 });
  }

  if (!onboarding) {
    log('warn', 'onboarding_sync', 'No employer_onboarding record found for user', {
      docId: doc.id,
      userId: doc.user_id,
    });
  }

  // employer_onboarding.status is purely the KYC-document rollup —
  // 'suspended'/'risk_review_in_progress' live in account_status instead and
  // never appear here.
  const onboardingStatus = onboarding?.status as
    | 'draft' | 'pending' | 'submitted' | 'under_review'
    | 'approved' | 'rejected' | undefined;

  log('info', 'onboarding_recompute', 'Read trigger-derived onboarding status', {
    docId: doc.id,
    userId: doc.user_id,
    onboardingStatus,
  });

  // KYC document review is its own gate, independent of account approval —
  // this route must never grant or revoke dashboard access (profiles.is_active)
  // as a side effect of a document outcome. Promotion to the live `employers`
  // table and dashboard-access activation happen exclusively via an admin's
  // explicit account-approval action in
  // app/api/admin/employers/[id]/status/route.ts. employer_onboarding.status
  // (the KYC rollup) and employers.is_verified (money-movement eligibility,
  // kept live-synced by fn_sync_employer_kyc_to_live()) already reflect this
  // review outcome — nothing further is needed here.

  const employerMessage =
    onboardingStatus === 'approved'
      ? `All of ${onboarding?.company_name ?? 'your company'}'s KYC documents have been reviewed and approved.`
      : onboardingStatus === 'rejected'
      ? `One or more KYC documents were rejected. ${notes ? `Reason: ${notes}` : ''}`.trim()
      : `Your ${doc.document_type.replace(/_/g, ' ')} document was ${status}.`;

  const { error: notifError } = await notifyEmployer({
    userId: doc.user_id,
    type: 'kyc_update',
    title:
      onboardingStatus === 'approved'
        ? 'KYC Review Complete'
        : onboardingStatus === 'rejected'
        ? 'KYC Requires Action'
        : 'KYC Document Reviewed',
    message: employerMessage,
  });

  if (notifError) {
    log('warn', 'notification', 'Failed to insert KYC notification', {
      docId: doc.id,
      userId: doc.user_id,
      onboardingStatus,
    }, notifError);
  }

  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email,
    target_id: docId,
    target_type: 'employer_kyc_document',
    action: `kyc_document_${status}`,
    old_value: null,
    new_value: { status, document_type: doc.document_type },
    metadata: { notes, onboarding_status: onboardingStatus, user_id: doc.user_id },
  }).then(({ error: auditErr }) => { if (auditErr) console.error('[audit] employer_kyc_document_reviewed:', auditErr); });

  return NextResponse.json({
    message: 'Document reviewed successfully',
    data: {
      document_id: doc.id,
      status,
      onboarding_status: onboardingStatus,
    },
  });
}
