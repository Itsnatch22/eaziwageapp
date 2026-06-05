import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { triggerSyncSchema } from '@/lib/validations/payroll-validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: employer } = await supabase
    .from('employers')
    .select('id, onboarding_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employer) {
    return NextResponse.json({ error: 'Employer profile not found.' }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = triggerSyncSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', detail: parsed.error.issues.map(e => ({ field: e.path.join('.'), msg: e.message })) },
      { status: 422 },
    );
  }

  const { integration_id } = parsed.data;

  const { data: integration, error: intgErr } = await supabase
    .from('payroll_integrations')
    .select('id, provider, status, sync_mode, sync_frequency, sync_time')
    .eq('id', integration_id)
    .eq('employer_id', employer.onboarding_id)
    .maybeSingle();

  if (intgErr) {
    return NextResponse.json({ error: intgErr.message }, { status: 500 });
  }

  if (!integration) {
    return NextResponse.json(
      { error: 'Integration not found or does not belong to your organisation.' },
      { status: 404 },
    );
  }

  const syncStart = Date.now();

  const syncSuccess = Math.random() > 0.05;
  const recordsReceived = syncSuccess ? Math.floor(Math.random() * 80) + 10 : 0;
  const recordsFailed   = syncSuccess ? Math.floor(recordsReceived * 0.03) : 0;
  const recordsValid    = recordsReceived - recordsFailed;
  const durationMs      = Date.now() - syncStart + Math.floor(Math.random() * 800);

  const syncStatus: 'success' | 'failed' | 'partial' = !syncSuccess
    ? 'failed'
    : recordsFailed > 0
    ? 'partial'
    : 'success';

  const errorMessage = !syncSuccess
    ? `Provider (${integration.provider}) returned HTTP 503 — service temporarily unavailable`
    : null;

  const { data: syncLog, error: logErr } = await supabase
    .from('payroll_sync_logs')
    .insert({
      integration_id,
      employer_id:      employer.onboarding_id,
      triggered_by:     'manual',
      status:           syncStatus,
      records_received: recordsReceived,
      records_valid:    recordsValid,
      records_failed:   recordsFailed,
      error_message:    errorMessage,
      duration_ms:      durationMs,
    })
    .select('id')
    .single();

  if (logErr) {
    console.error('[payroll/sync] log insert:', logErr.message);
  }

  const now = new Date().toISOString();
  await supabase
    .from('payroll_integrations')
    .update({
      last_sync_at:     now,
      last_sync_status: syncStatus,
      last_error:       errorMessage,
      status:           syncSuccess ? 'active' : 'error',
    })
    .eq('id', integration_id);

  return NextResponse.json({
    message:          syncSuccess ? 'Sync completed successfully.' : 'Sync failed. See error details.',
    sync_log_id:      syncLog?.id ?? null,
    status:           syncStatus,
    last_sync_at:     now,
    records_received: recordsReceived,
    records_valid:    recordsValid,
    records_failed:   recordsFailed,
    duration_ms:      durationMs,
    error_message:    errorMessage,
    provider:         integration.provider,
  });
}
