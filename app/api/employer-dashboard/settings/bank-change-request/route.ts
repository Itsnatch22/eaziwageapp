import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { notifyAdmin } from '@/lib/notifications';
import { getEnv } from '@/env';
import { z } from 'zod';
import { requireRecentMfa } from '@/lib/server/recent-mfa';

const bankChangeSchema = z.object({
  bank_name: z.string().min(2, 'Bank name is required'),
  bank_account_number: z.string().min(5, 'Account number is required'),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'employer') {
      return NextResponse.json({ error: 'Forbidden. Employer access required.' }, { status: 403 });
    }

    const stepUpResponse = await requireRecentMfa(supabase, user.id);
    if (stepUpResponse) return stepUpResponse;

    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select(`
        id,
        onboarding_id,
        company_name,
        employer_onboarding!onboarding_id (
          bank_name,
          bank_account_number,
          deleted_at
        )
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError) {
      console.error('[bank-change-request] Employer fetch error:', employerError);
      return NextResponse.json({ error: 'Failed to fetch employer profile' }, { status: 500 });
    }

    if (!employer) {
      return NextResponse.json(
        { error: 'Your account is pending approval. Bank change requests can be submitted once approved.' },
        { status: 403 },
      );
    }
    const onboarding = Array.isArray(employer.employer_onboarding)
      ? employer.employer_onboarding[0]
      : employer.employer_onboarding;

    if (onboarding?.deleted_at) {
      return NextResponse.json({ error: 'Employer record not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bankChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 422 });
    }

    const { bank_name, bank_account_number, reason } = parsed.data;

    const { PII_ENCRYPTION_KEY } = getEnv();
    if (!PII_ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'Encryption not configured' }, { status: 500 });
    }

    const { data: requestId, error: rpcError } = await supabase.rpc('submit_bank_change_request', {
      p_new_bank_name: bank_name,
      p_new_account_number: bank_account_number,
      p_reason: reason ?? '',
      p_key: PII_ENCRYPTION_KEY,
    });

    if (rpcError) {
      console.error('[bank-change-request] RPC error:', rpcError);
      const pending = rpcError.message?.includes('already pending');
      return NextResponse.json(
        { error: pending ? 'You already have a pending bank change request.' : 'Failed to submit request' },
        { status: pending ? 409 : 500 },
      );
    }

    // Request is durable now. Notification is best-effort, so don't fail the user over it.
    const maskAccount = (account: string) => `****${account.slice(-4)}`;
    const { success: notifSuccess, error: notifError } = await notifyAdmin({
      type: 'bank_change',
      title: 'Bank Details Change Request',
      message: `${employer.company_name} is requesting to change their bank details.`,
      metadata: {
        employer_id: employer.onboarding_id,
        company_name: employer.company_name,
        current_bank: onboarding?.bank_name,
        requested_bank: bank_name,
        requested_account_masked: maskAccount(bank_account_number),
        reason: reason || 'Not provided',
        request_type: 'bank_change',
        request_id: requestId,
      },
    });

    if (!notifSuccess) console.error('[bank-change-request] Notification error:', notifError);

    return NextResponse.json({ success: true, message: 'Bank change request submitted successfully. Our team will review it shortly.' });

  } catch (error) {
    console.error('[POST /api/employer-dashboard/settings/bank-change-request] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
