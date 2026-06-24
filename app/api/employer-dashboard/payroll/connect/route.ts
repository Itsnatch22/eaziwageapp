
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { connectPayrollSchema } from '@/lib/validations/payroll-validation';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

function generateIntegrationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = 'EWA-';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
    if (i === 3) code += '-';
  }
  return code;
}

function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, onboarding_id')
      .eq('user_id', user.id)
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
       .eq('employer_live_id', employer.id)
       .order('created_at', { ascending: false });

    if (error) {
      console.error('[payroll/connect] fetch integrations error', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const shaped = (integrations ?? []).map(intg => ({
      ...intg,
      sync_logs: (intg.sync_logs ?? [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    }));

    return NextResponse.json({ integrations: shaped });
  } catch (err: unknown) {
    console.error('[payroll/connect] unexpected error', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, onboarding_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError) {
      console.error('[payroll/connect] employer lookup error', employerError.message);
      return NextResponse.json({ error: 'Failed to resolve employer' }, { status: 500 });
    }

    if (!employer) {
      return NextResponse.json({ error: 'Employer profile not found.' }, { status: 403 });
    }

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

const { data: existing, error: existingError } = await supabase
       .from('payroll_integrations')
       .select('id, integration_code, webhook_secret')
       .eq('employer_live_id', employer.id)
       .eq('provider', provider)
       .maybeSingle();

    if (existingError) {
      console.error('[payroll/connect] existing lookup error', existingError.message);
      return NextResponse.json({ error: 'Failed to check existing integrations' }, { status: 500 });
    }

    let integrationCode: string;
    let webhookSecret: string;

    if (existing) {
      integrationCode = existing.integration_code;
      webhookSecret   = existing.webhook_secret ?? generateWebhookSecret();

      const { error: updateErr } = await supabase
        .from('payroll_integrations')
        .update({
          provider_label,
          sync_mode,
          sync_frequency,
          sync_time,
          status:         'pending',
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
           employer_id:      employer.onboarding_id,
           employer_live_id: employer.id,
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

  } catch (err: unknown) {
    console.error('[payroll/connect] unexpected error', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const integrationCode = body?.integration_code as string | undefined;
    const integrationId = body?.id as string | undefined;

    if (!integrationCode && !integrationId) return NextResponse.json({ error: 'Missing integration identifier' }, { status: 400 });

    const { data: emp, error: empError } = await supabase
      .from('employers')
      .select('id, onboarding_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (empError) {
      console.error('[payroll/connect][DELETE] employer lookup error', empError);
      return NextResponse.json({ error: 'Failed to resolve employer' }, { status: 500 });
    }
    if (!emp) return NextResponse.json({ error: 'Employer profile not found.' }, { status: 403 });

    const q = supabase
      .from('payroll_integrations')
      .delete();

    if (integrationId) q.eq('id', integrationId);
    if (integrationCode) q.eq('integration_code', integrationCode);

    q.eq('employer_live_id', emp.id);

    const { error: delErr } = await q;
    if (delErr) {
      console.error('[payroll/connect][DELETE] delete error', delErr);
      return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[payroll/connect][DELETE] unexpected', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
