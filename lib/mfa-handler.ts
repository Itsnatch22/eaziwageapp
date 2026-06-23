import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { apiLimiter, mfaActionLimiter, mfaVerifyLimiter, checkRateLimit, type RateLimitResult } from '@/lib/rate-limit';

function getMfaClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip') ??
    '0.0.0.0'
  ).trim();
}

function buildRateLimitHeaders(rate: RateLimitResult): Record<string, string> {
  const headers = { ...(rate?.headers || {}) } as Record<string, string>;
  const reset = typeof rate?.reset === 'number' ? rate.reset : undefined;
  if (reset) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil((reset - Date.now()) / 1000)));
  }
  return headers;
}

export async function handleMfaGet(req: NextRequest, keyPrefix: string): Promise<NextResponse> {
  const ip = getMfaClientIp(req);
  const rate = await checkRateLimit(apiLimiter, `mfa-status${keyPrefix}:${ip}`);
  const rateHeaders = buildRateLimitHeaders(rate);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateHeaders });

  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: rateHeaders });

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) return NextResponse.json({ error: 'Failed to check MFA status' }, { status: 500, headers: rateHeaders });

    const totpFactors = factors?.all?.filter(f => f.factor_type === 'totp') || [];
    return NextResponse.json({ enabled: totpFactors.length > 0, factors: totpFactors }, { headers: rateHeaders });
  } catch (error: unknown) {
    console.error('[MFA][GET] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

export async function handleMfaPost(
  req: NextRequest,
  keyPrefix: string,
  defaultFriendlyName: string
): Promise<NextResponse> {
  const ip = getMfaClientIp(req);
  const apiRate = await checkRateLimit(apiLimiter, `mfa-api${keyPrefix}:${ip}`);
  const apiRateHeaders = buildRateLimitHeaders(apiRate);
  if (!apiRate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: apiRateHeaders });

  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: apiRateHeaders });

    const body = await req.json();
    const { action } = body;
    const actionKey = `mfa-action${keyPrefix}:${user.id || ip}`;

    if (action === 'enable') {
      const actionRate = await checkRateLimit(mfaActionLimiter, actionKey);
      const actionHeaders = buildRateLimitHeaders(actionRate);
      if (!actionRate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: actionHeaders });

      const friendlyName = typeof body?.friendlyName === 'string' ? body.friendlyName.trim() : defaultFriendlyName;
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });

      if (error) {
        console.error('[MFA][enable] enroll error:', { userId: user.id, ip, error });
        return NextResponse.json({ error: 'Failed to enroll MFA' }, { status: 400, headers: actionHeaders });
      }
      return NextResponse.json(
        { success: true, qrCode: data.totp?.qr_code || '', secret: data.totp?.secret || '', factorId: data.id || '' },
        { headers: actionHeaders }
      );

    } else if (action === 'disable') {
      const actionRate = await checkRateLimit(mfaActionLimiter, actionKey);
      const actionHeaders = buildRateLimitHeaders(actionRate);
      if (!actionRate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: actionHeaders });

      const factorId = typeof body?.factorId === 'string' ? body.factorId : null;
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        console.error('[MFA][disable] listFactors error:', { userId: user.id, ip, error: factorsError });
        return NextResponse.json({ error: 'Failed to list MFA factors' }, { status: 500, headers: actionHeaders });
      }

      const totpFactors = factors?.all?.filter(f => f.factor_type === 'totp') || [];
      if (totpFactors.length === 0) return NextResponse.json({ error: 'No MFA factors found' }, { status: 400, headers: actionHeaders });

      const targetFactor = factorId ? totpFactors.find(f => f.id === factorId) : totpFactors[0];
      if (!targetFactor) return NextResponse.json({ error: 'Factor not found' }, { status: 404, headers: actionHeaders });

      const { error: unregisterError } = await supabase.auth.mfa.unenroll({ factorId: targetFactor.id });
      if (unregisterError) {
        console.error('[MFA][disable] unenroll error:', { userId: user.id, ip, error: unregisterError });
        return NextResponse.json({ error: 'Failed to unenroll factor' }, { status: 400, headers: actionHeaders });
      }

      try {
        await createAdminClient().from('system_audit_logs').insert({
          admin_id: user.id,
          admin_name: user.email,
          target_id: user.id,
          target_type: 'user',
          action: 'mfa_unenrolled',
          new_value: { factorId: targetFactor.id },
          metadata: { ip, user_agent: req.headers.get('user-agent') },
        });
      } catch (auditErr) {
        console.error('[MFA][disable] audit insert failed:', auditErr);
      }

      return NextResponse.json({ success: true, message: 'MFA disabled successfully' }, { headers: actionHeaders });

    } else if (action === 'generate_backup_codes') {
      const actionRate = await checkRateLimit(mfaActionLimiter, actionKey);
      const actionHeaders = buildRateLimitHeaders(actionRate);
      if (!actionRate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: actionHeaders });

      try {
        const { randomBytes, createHash } = await import('crypto');
        const codes = Array.from({ length: 10 }).map(() => randomBytes(5).toString('hex').toUpperCase());
        const rows = codes.map(code => ({
          user_id: user.id,
          code_hash: createHash('sha256').update(code).digest('hex'),
          used: false,
          created_at: new Date().toISOString(),
        }));

        const adminSupabase = createAdminClient();
        const { error: deleteErr } = await adminSupabase
          .from('system_mfa_backup_codes')
          .delete()
          .eq('user_id', user.id);
        if (deleteErr) {
          console.error('[MFA][backup] delete existing codes failed:', { userId: user.id, error: deleteErr });
          return NextResponse.json({ error: 'Failed to generate backup codes' }, { status: 500, headers: actionHeaders });
        }
        const { error: insertErr } = await adminSupabase.from('system_mfa_backup_codes').insert(rows);
        if (insertErr) {
          console.error('[MFA][backup] insert codes failed:', { userId: user.id, error: insertErr });
          return NextResponse.json({ error: 'Failed to generate backup codes' }, { status: 500, headers: actionHeaders });
        }

        return NextResponse.json({ success: true, backupCodes: codes }, { headers: actionHeaders });
      } catch (err) {
        console.error('[MFA][backup] generation error:', err);
        return NextResponse.json({ error: 'Failed to generate backup codes' }, { status: 500, headers: actionHeaders });
      }

    } else if (action === 'verify') {
      const verifyRate = await checkRateLimit(mfaVerifyLimiter, `mfa-verify${keyPrefix}:${user.id || ip}`);
      const verifyHeaders = buildRateLimitHeaders(verifyRate);
      if (!verifyRate.success) return NextResponse.json({ error: 'Too many verification attempts' }, { status: 429, headers: verifyHeaders });

      const { factorId, code } = body;
      if (!factorId || !code) {
        return NextResponse.json({ error: 'Factor ID and verification code are required' }, { status: 400, headers: verifyHeaders });
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        console.error('[MFA][verify] listFactors error:', { userId: user.id, ip, error: factorsError });
        return NextResponse.json({ error: 'Failed to verify factor ownership' }, { status: 500, headers: verifyHeaders });
      }

      const totpFactors = factors?.all?.filter(f => f.factor_type === 'totp') || [];
      if (!totpFactors.some(f => f.id === factorId)) {
        return NextResponse.json({ error: 'Factor not found or not owned by this account' }, { status: 404, headers: verifyHeaders });
      }

      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) {
        console.error('[MFA][verify] verify error:', { userId: user.id, ip, error });
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400, headers: verifyHeaders });
      }

      try {
        await createAdminClient().from('system_audit_logs').insert({
          admin_id: user.id,
          admin_name: user.email,
          target_id: user.id,
          target_type: 'user',
          action: 'mfa_enrolled',
          new_value: { factorId },
          metadata: { ip, user_agent: req.headers.get('user-agent') },
        });
      } catch (auditErr) {
        console.error('[MFA][verify] audit insert failed:', auditErr);
      }

      return NextResponse.json({ success: true, message: 'MFA verification successful' }, { headers: verifyHeaders });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: apiRateHeaders });
    }
  } catch (error: unknown) {
    console.error('[MFA][POST] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
