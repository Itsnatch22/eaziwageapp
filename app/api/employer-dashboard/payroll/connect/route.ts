// app/api/payroll/connect/route.ts
//
// GET  /api/payroll/connect  — fetch the employer's active integration(s)
// POST /api/payroll/connect  — link a payroll provider and generate an integration code
//
// The integration_code is a short alphanumeric token the employer shares with
// their IT team. External systems include it as a Bearer token on API push calls.
//
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { connectPayrollSchema } from '@/lib/validations/payroll-validation';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

// ── Generate a human-friendly integration code ────────────────────────────────
// Format: EWA-XXXX-XXXX  (uppercase alphanumeric, 8 chars + prefix)
function generateIntegrationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable chars (0,O,1,I)
  const bytes = randomBytes(8);
  let code = 'EWA-';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
    if (i === 3) code += '-';
  }
  return code;
}

// ── Generate a webhook HMAC secret ───────────────────────────────────────────
function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — return this employer's integrations (with last sync metadata)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error: employerError } = await supabase
      .from('employer_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (employerError) {
      console.error('[payroll/connect] employer lookup error', employerError.message);
      return NextResponse.json({ error: 'Failed to resolve employer' }, { status: 500 });
    }

    if (!employer) {
      return NextResponse.json({ integrations: [] });
    }

    const { data: integrations, error } = await supabase
      .from('payroll_integrations')
      .select(`
        id, provider, provider_label, integration_code,
        sync_mode, sync_frequency, sync_time,
        status, last_sync_at, last_sync_status, last_error,
        connected_by, created_at, updated_at,
        sync_logs:payroll_sync_logs (
          id, status, records_received, records_valid, records_failed,
          error_message, duration_ms, created_at
        )
      `)
      .eq('employer_id', employer.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[payroll/connect] fetch integrations error', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Attach only the last 5 sync logs per integration to keep payload small
    const shaped = (integrations ?? []).map(intg => ({
      ...intg,
      sync_logs: (intg.sync_logs ?? [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    }));

    return NextResponse.json({ integrations: shaped });
  } catch (err: any) {
    console.error('[payroll/connect] unexpected error', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — create or update a payroll integration
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error: employerError } = await supabase
      .from('employer_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (employerError) {
      console.error('[payroll/connect] employer lookup error', employerError.message);
      return NextResponse.json({ error: 'Failed to resolve employer' }, { status: 500 });
    }

    if (!employer) {
      return NextResponse.json({ error: 'Employer profile not found.' }, { status: 403 });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const parsed = connectPayrollSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', detail: parsed.error.issues.map(e => ({ field: e.path.join('.'), msg: e.message })) },
        { status: 422 },
      );
    }

    const { provider, provider_label, sync_mode, sync_frequency, sync_time } = parsed.data;

    // ── Check if integration already exists for this provider ─────────────────
    const { data: existing, error: existingError } = await supabase
      .from('payroll_integrations')
      .select('id, integration_code, webhook_secret')
      .eq('employer_id', employer.id)
      .eq('provider', provider)
      .maybeSingle();

    if (existingError) {
      console.error('[payroll/connect] existing lookup error', existingError.message);
      return NextResponse.json({ error: 'Failed to check existing integrations' }, { status: 500 });
    }

    let integrationCode: string;
    let webhookSecret: string;

    if (existing) {
      // Reuse existing codes so the employer's IT team doesn't need to update theirs
      integrationCode = existing.integration_code;
      webhookSecret   = existing.webhook_secret ?? generateWebhookSecret();

      const { error: updateErr } = await supabase
        .from('payroll_integrations')
        .update({
          provider_label,
          sync_mode,
          sync_frequency,
          sync_time,
          status:         'pending', // resets to pending; re-verified on first sync
          webhook_secret: webhookSecret,
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error('[payroll/connect] update error', updateErr.message);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      integrationCode = generateIntegrationCode();
      webhookSecret   = generateWebhookSecret();

      const { error: insertErr } = await supabase
        .from('payroll_integrations')
        .insert({
          employer_id:      employer.id,
          provider,
          provider_label,
          integration_code: integrationCode,
          webhook_secret:   webhookSecret,
          sync_mode,
          sync_frequency,
          sync_time,
          status:           'pending',
          connected_by:     user.id,
        });

      if (insertErr) {
        console.error('[payroll/connect] insert:', insertErr.message);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        message:          existing ? 'Integration updated.' : 'Integration created.',
        integration_code: integrationCode,
        webhook_secret:   webhookSecret,
        provider,
        sync_mode,
        sync_frequency,
        sync_time,
        instructions: {
          summary: `Share the integration_code with your ${provider} administrator.`,
          endpoint: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/payroll/inbound`,
          auth_header: `Authorization: Bearer <integration_code>`,
          hmac_header: `X-EWA-Signature: HMAC-SHA256 of request body using webhook_secret`,
        },
      },
      { status: existing ? 200 : 201 },
    );
  } catch (err: any) {
    console.error('[payroll/connect] unexpected error', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}