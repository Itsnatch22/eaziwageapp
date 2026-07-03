import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { apiLimiter, mfaActionLimiter, mfaVerifyLimiter, checkRateLimit, type RateLimitResult } from '@/lib/rate-limit';
import { getEnv } from '@/env';

// Backup codes aren't a real Supabase MFA factor, so verifying one can't elevate
// the session to Supabase's own aal2 the way challengeAndVerify does. Instead we
// mint a short-lived signed cookie that proxy.ts accepts as an alternate proof of
// second-factor completion for this browser — bounded to 12h rather than an
// indefinite bypass, matching the "lost my authenticator, need back in" use case
// without permanently weakening the aal2 gate.
export const MFA_BACKUP_COOKIE = 'mfa_backup_verified';
const MFA_BACKUP_COOKIE_TTL_MS = 12 * 60 * 60 * 1000;

export function signMfaBackupCookie(userId: string, hmacKey: string): { value: string; maxAge: number } {
  const expiresAt = Date.now() + MFA_BACKUP_COOKIE_TTL_MS;
  const signature = createHmac('sha256', hmacKey).update(`${userId}.${expiresAt}`).digest('hex');
  return { value: `${expiresAt}.${signature}`, maxAge: MFA_BACKUP_COOKIE_TTL_MS / 1000 };
}

/**
 * Verifies a raw mfa_backup_verified cookie value against a userId. Shared by
 * proxy.ts (reads via NextRequest.cookies) and any route handler that needs
 * to re-check AAL itself (reads via next/headers cookies()) — both must
 * agree on what counts as "second factor satisfied," or a route handler's
 * own redundant check can end up stricter than the gate that already let the
 * request through, blocking legitimate backup-code sessions.
 */
export function verifyMfaBackupCookie(rawValue: string | undefined, userId: string): boolean {
  const hmacKey = process.env.PII_ENCRYPTION_KEY;
  if (!rawValue || !hmacKey) return false;

  const [expiresAtStr, signature] = rawValue.split('.');
  if (!expiresAtStr || !signature) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = createHmac('sha256', hmacKey).update(`${userId}.${expiresAtStr}`).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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
        const { randomBytes, createHmac } = await import('crypto');
        const hmacKey = getEnv().PII_ENCRYPTION_KEY;
        if (!hmacKey) {
          return NextResponse.json({ error: 'Backup code signing not configured' }, { status: 500, headers: actionHeaders });
        }
        const codes = Array.from({ length: 10 }).map(() => randomBytes(5).toString('hex').toUpperCase());
        const rows = codes.map(code => ({
          user_id: user.id,
          // HMAC-SHA256: keyed hash prevents rainbow-table lookup on the finite backup-code space
          code_hash: createHmac('sha256', hmacKey).update(code).digest('hex'),
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

    } else if (action === 'verify_backup_code') {
      const verifyRate = await checkRateLimit(mfaVerifyLimiter, `mfa-verify${keyPrefix}:${user.id || ip}`);
      const verifyHeaders = buildRateLimitHeaders(verifyRate);
      if (!verifyRate.success) return NextResponse.json({ error: 'Too many verification attempts' }, { status: 429, headers: verifyHeaders });

      const rawCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
      if (!rawCode) return NextResponse.json({ error: 'Backup code is required' }, { status: 400, headers: verifyHeaders });

      const hmacKey = getEnv().PII_ENCRYPTION_KEY;
      if (!hmacKey) return NextResponse.json({ error: 'Backup code verification not configured' }, { status: 500, headers: verifyHeaders });

      const codeHash = createHmac('sha256', hmacKey).update(rawCode).digest('hex');
      const adminSupabase = createAdminClient();

      const { data: matched, error: matchErr } = await adminSupabase
        .from('system_mfa_backup_codes')
        .select('id')
        .eq('user_id', user.id)
        .eq('code_hash', codeHash)
        .eq('used', false)
        .maybeSingle();

      if (matchErr) {
        console.error('[MFA][backup] lookup error:', { userId: user.id, error: matchErr });
        return NextResponse.json({ error: 'Failed to verify backup code' }, { status: 500, headers: verifyHeaders });
      }
      if (!matched) {
        return NextResponse.json({ error: 'Invalid or already-used backup code' }, { status: 400, headers: verifyHeaders });
      }

      const { error: consumeErr } = await adminSupabase
        .from('system_mfa_backup_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', matched.id);
      if (consumeErr) {
        console.error('[MFA][backup] consume error:', { userId: user.id, error: consumeErr });
        return NextResponse.json({ error: 'Failed to verify backup code' }, { status: 500, headers: verifyHeaders });
      }

      try {
        await adminSupabase.from('system_audit_logs').insert({
          admin_id: user.id,
          admin_name: user.email,
          target_id: user.id,
          target_type: 'user',
          action: 'mfa_backup_code_used',
          new_value: { backup_code_id: matched.id },
          metadata: { ip, user_agent: req.headers.get('user-agent') },
        });
      } catch (auditErr) {
        console.error('[MFA][backup] audit insert failed:', auditErr);
      }

      const response = NextResponse.json({ success: true, message: 'Backup code accepted' }, { headers: verifyHeaders });
      const { value, maxAge } = signMfaBackupCookie(user.id, hmacKey);
      response.cookies.set(MFA_BACKUP_COOKIE, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      return response;

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
