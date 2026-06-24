import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { notifyAdmin } from '@/lib/notifications';
import { getEnv } from '@/env';
import { z } from 'zod';

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
      return NextResponse.json({ error: 'Employer record not found' }, { status: 404 });
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

    // Insert the request row without raw account numbers — PII written via RPC below
    const { data: requestRecord, error: requestError } = await supabase
      .from('bank_change_requests')
      .insert({
        employer_id:      employer.onboarding_id,
        employer_live_id: employer.id,
        user_id:          user.id,
        old_bank_name:    onboarding?.bank_name,
        new_bank_name:    bank_name,
        reason:           reason || 'Not provided',
        status:           'pending',
      })
      .select('id')
      .single();

    if (requestError) {
      console.error('[bank-change-request] DB error:', requestError);
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }

    // Encrypt old/new account numbers — row must exist before this is called
    const { PII_ENCRYPTION_KEY } = getEnv();
    if (!PII_ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'Encryption not configured' }, { status: 500 });
    }

    const { error: piiError } = await supabase.rpc('insert_bank_change_request_pii', {
      p_request_id:  requestRecord.id,
      p_old_account: onboarding?.bank_account_number ?? null,
      p_new_account: bank_account_number,
      p_key:         PII_ENCRYPTION_KEY,
    });

    if (piiError) {
      console.error('[bank-change-request] PII error:', piiError);
      return NextResponse.json({ error: 'Failed to save secure fields' }, { status: 500 });
    }

    const { success: notifSuccess, error: notifError } = await notifyAdmin({
      type: 'bank_change',
      title: 'Bank Details Change Request',
      message: `${employer.company_name} is requesting to change their bank details.`,
      metadata: {
        employer_id: employer.onboarding_id,
        company_name: employer.company_name,
        current_bank: onboarding?.bank_name,
        current_account: onboarding?.bank_account_number,
        requested_bank: bank_name,
        requested_account: bank_account_number,
        reason: reason || 'Not provided',
        request_type: 'bank_change',
        request_id: requestRecord?.id
      },
    });

    if (!notifSuccess) {
      console.error('[bank-change-request] Notification error:', notifError);
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Bank change request submitted successfully. Our team will review it shortly.' 
    });

  } catch (error) {
    console.error('[POST /api/employer-dashboard/settings/bank-change-request] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
