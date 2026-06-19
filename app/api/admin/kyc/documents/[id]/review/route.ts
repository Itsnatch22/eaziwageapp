import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { notifyEmployee } from '@/lib/notifications';

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  docId?: string;
  userId?: string;
  employerId?: string;
  status?: string | null;
  onboardingStatus?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, step: string, message: string, ctx: LogContext = {}, err?: unknown) {
  const entry = {
    level,
    route: 'PATCH /api/admin/kyc/[id]',
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
  const status = searchParams.get('status');
  const notes = searchParams.get('notes') || '';

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-kyc-review:${ip}`);

  if (!rateResult.success) {
    log('warn', 'rate_limit', 'Rate limit exceeded', { docId, ip });
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
    log('warn', 'auth', 'Unauthenticated request', { docId }, authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = getEnv();
  const adminSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: systemAdmin } = await adminSupabase
    .from('system_admins')
    .select('id, is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!systemAdmin || !systemAdmin.is_admin) {
    log('warn', 'admin_check', 'Non-admin attempted KYC review', { docId, userId: user.id });
    return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
  }

  if (!['approved', 'rejected'].includes(status || '')) {
    log('warn', 'validation', 'Invalid status value provided', { docId, userId: user.id, status });
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: reviewedDoc, error: updateError } = await adminSupabase
    .from('employee_kyc_documents')
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

  const { data: docsForUser, error: docsError } = await adminSupabase
    .from('employee_kyc_documents')
    .select('status')
    .eq('user_id', doc.user_id);

  if (docsError) {
    log('error', 'onboarding_recompute', 'Failed to fetch user KYC documents', { docId: doc.id, userId: doc.user_id }, docsError);
    return NextResponse.json({ error: 'Failed to finalize KYC review' }, { status: 500 });
  }

  const totalDocs = docsForUser?.length ?? 0;
  const hasRejected = (docsForUser ?? []).some((d) => d.status === 'rejected');
  const allApproved = totalDocs > 0 && (docsForUser ?? []).every((d) => d.status === 'approved');

  let onboardingStatus: 'approved' | 'rejected' | 'pending' = 'pending';
  if (hasRejected) onboardingStatus = 'rejected';
  else if (allApproved) onboardingStatus = 'approved';

  log('info', 'onboarding_recompute', 'Recomputed onboarding status', {
    docId: doc.id,
    userId: doc.user_id,
    totalDocs,
    hasRejected,
    allApproved,
    onboardingStatus,
  });

  const { data: employeeOnboarding, error: employeeError } = await adminSupabase
    .from('employee_onboarding')
    .update({ status: onboardingStatus, updated_at: new Date().toISOString() })
    .eq('user_id', doc.user_id)
    .select('id,employer_id,monthly_salary')
    .limit(1)
    .maybeSingle();

  if (employeeError) {
    log('error', 'onboarding_sync', 'Failed to sync employee onboarding status', {
      docId: doc.id,
      userId: doc.user_id,
      onboardingStatus,
    }, employeeError);
    return NextResponse.json({ error: 'Failed to sync employee status' }, { status: 500 });
  }

  if (!employeeOnboarding) {
    log('warn', 'onboarding_sync', 'No employee_onboarding record found for user', {
      docId: doc.id,
      userId: doc.user_id,
    });
  }

  if (onboardingStatus === 'approved' && employeeOnboarding?.id && employeeOnboarding?.employer_id) {
    const monthlySalary = Number(employeeOnboarding.monthly_salary ?? 0);
    const initialLimit = Math.max(5000, Math.round(monthlySalary * 0.5) || 5000);

    log('info', 'ewa_bootstrap', 'Bootstrapping EWA settings', {
      userId: doc.user_id,
      employerId: employeeOnboarding.employer_id,
      onboardingId: employeeOnboarding.id,
      monthlySalary,
      initialLimit,
    });

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
      log('error', 'ewa_bootstrap', 'Failed to initialize EWA settings', {
        userId: doc.user_id,
        employerId: employeeOnboarding.employer_id,
        onboardingId: employeeOnboarding.id,
      }, ewaError);
    } else {
      log('info', 'ewa_bootstrap', 'EWA settings initialized successfully', {
        userId: doc.user_id,
        onboardingId: employeeOnboarding.id,
      });
    }
  }

  const employeeMessage =
    onboardingStatus === 'approved'
      ? 'Your KYC has been fully approved and your account is now active.'
      : onboardingStatus === 'rejected'
      ? `One or more KYC documents were rejected. ${notes ? `Reason: ${notes}` : ''}`.trim()
      : `Your ${doc.document_type.replace(/_/g, ' ')} document was ${status}.`;

  const { error: notifError } = await notifyEmployee({
    userId: doc.user_id,
    type: 'kyc_update',
    title:
      onboardingStatus === 'approved'
        ? 'KYC Approved'
        : onboardingStatus === 'rejected'
        ? 'KYC Requires Action'
        : 'KYC Document Reviewed',
    message: employeeMessage,
  });

  if (notifError) {
    log('warn', 'notification', 'Failed to insert KYC notification', {
      docId: doc.id,
      userId: doc.user_id,
      onboardingStatus,
    }, notifError);
  }

  try {
    log('info', 'pusher', 'Pusher events skipped (migrated to Supabase Realtime)', {
      docId: doc.id,
      userId: doc.user_id,
      employerId: employeeOnboarding?.employer_id,
      onboardingStatus,
    });
  } catch (pusherErr) {
    log('error', 'pusher', 'Failed to trigger Pusher event(s)', {
      docId: doc.id,
      userId: doc.user_id,
      employerId: employeeOnboarding?.employer_id,
    }, pusherErr);
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
