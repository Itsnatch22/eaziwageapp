import * as crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function decryptSecret(encrypted: string, key: string): string | null {
  try {

    const [b64iv, b64tag, b64ct] = encrypted.split(':');
    if (!b64iv || !b64tag || !b64ct) return null;
    const iv = Buffer.from(b64iv, 'base64');
    const tag = Buffer.from(b64tag, 'base64');
    const ct = Buffer.from(b64ct, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[reveal] decryptSecret error', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const integrationCode = body?.integration_code;
    if (!integrationCode) return NextResponse.json({ error: 'Missing integration_code' }, { status: 400 });


    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, onboarding_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employerError) {
      console.error('[reveal] employer lookup error', employerError);
      return NextResponse.json({ error: 'Failed to resolve employer' }, { status: 500 });
    }

    if (!employer) return NextResponse.json({ error: 'Employer profile not found.' }, { status: 403 });


    const { data: integration, error: intErr } = await supabaseAdmin
      .from('payroll_integrations')
      .select('id, employer_id, integration_code, webhook_secret, webhook_secret_encrypted')
      .eq('employer_id', employer.onboarding_id)
      .eq('integration_code', integrationCode)
      .maybeSingle();

    if (intErr) {
      console.error('[reveal] integration lookup error', intErr);
      return NextResponse.json({ error: 'Failed to lookup integration' }, { status: 500 });
    }

    if (!integration) return NextResponse.json({ error: 'Integration not found' }, { status: 404 });


    const encrypted = integration.webhook_secret_encrypted as string | null;
    const plain = integration.webhook_secret as string | null;
    let secret: string | null = null;

    const encKey = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;

    if (encrypted && encKey) {
      secret = decryptSecret(encrypted, encKey);
      if (!secret) {
        console.error('[reveal] failed to decrypt webhook secret for integration', integration.id);
        return NextResponse.json({ error: 'Failed to decrypt secret' }, { status: 500 });
      }
    } else if (plain) {

      secret = plain;
      console.warn('[reveal] returning plaintext webhook_secret; migrate to encrypted storage ASAP');
    } else {
      return NextResponse.json({ error: 'No webhook secret configured for this integration' }, { status: 404 });
    }


    try {
      await supabaseAdmin.from('system_audit_logs').insert([{ 
        admin_id: user.id,
        admin_name: user.email ?? null,
        target_id: integration.id,
        target_type: 'payroll_integration',
        action: 'reveal_webhook_secret',
        metadata: { integration_code: integrationCode },
      }]);
    } catch (auditErr) {
      console.error('[reveal] audit insert failed', auditErr);

    }

    return NextResponse.json({ secret }, { status: 200 });
  } catch (err) {
    console.error('[reveal] unexpected error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
