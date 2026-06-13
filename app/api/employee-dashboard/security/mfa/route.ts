import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { apiLimiter, mfaActionLimiter, mfaVerifyLimiter, checkRateLimit, type RateLimitResult } from '@/lib/rate-limit';
import { getEnv } from '@/env';

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                     ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip')              ??
    '0.0.0.0'
  ).trim();
}

function buildRateLimitResponseHeaders(rate: RateLimitResult) {
  // checkRateLimit returns headers and reset timestamp
  const headers = { ...(rate?.headers || {}) } as Record<string, string>;
  try {
    const reset = typeof rate?.reset === 'number' ? rate.reset : undefined;
    if (reset) {
      const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      headers['Retry-After'] = String(retryAfterSec);
    }
  } catch {
    // ignore
  }
  return headers;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = await checkRateLimit(apiLimiter, `mfa-status:${ip}`);
  const rateHeaders = buildRateLimitResponseHeaders(rate);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateHeaders });

  try {
    const supabase = await createRouteHandlerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: rateHeaders });
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

    if (factorsError) {
      return NextResponse.json({ error: "Failed to check MFA status" }, { status: 500, headers: rateHeaders });
    }

    const totpFactors = factors?.all?.filter(factor => factor.factor_type === 'totp') || [];
    const mfaEnabled = totpFactors.length > 0;

    return NextResponse.json({ 
      enabled: mfaEnabled,
      factors: totpFactors
    }, { headers: rateHeaders });

  } catch (error: unknown) {
    console.error("Get MFA status error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const apiRate = await checkRateLimit(apiLimiter, `mfa-api:${ip}`);
  const apiRateHeaders = buildRateLimitResponseHeaders(apiRate);
  if (!apiRate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: apiRateHeaders });

  try {
    const supabase = await createRouteHandlerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: apiRateHeaders });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'enable') {
      const actionRate = await checkRateLimit(mfaActionLimiter, `mfa-action:${user.id || ip}`);
      const actionHeaders = buildRateLimitResponseHeaders(actionRate);
      if (!actionRate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: actionHeaders });

      const friendlyName = typeof body?.friendlyName === 'string' ? body.friendlyName.trim() : 'EaziWage Authenticator';

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName
      });

      if (error) {
        console.error('[MFA][enable] enroll error:', { userId: user.id, ip, error });
        return NextResponse.json({ error: 'Failed to enroll MFA' }, { status: 400, headers: actionHeaders });
      }
      
      return NextResponse.json({ 
        success: true,
        qrCode: data.totp?.qr_code || '',
        secret: data.totp?.secret || '',
        factorId: data.id || ''
      }, { headers: actionHeaders });

    } else if (action === 'disable') {
      const actionRate = await checkRateLimit(mfaActionLimiter, `mfa-action:${user.id || ip}`);
      const actionHeaders = buildRateLimitResponseHeaders(actionRate);
      if (!actionRate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: actionHeaders });

      const factorId = typeof body?.factorId === 'string' ? body.factorId : null;

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        console.error('[MFA][disable] listFactors error:', { userId: user.id, ip, error: factorsError });
        return NextResponse.json({ error: "Failed to list MFA factors" }, { status: 500, headers: actionHeaders });
      }

      const totpFactors = factors?.all?.filter(factor => factor.factor_type === 'totp') || [];
      
      if (totpFactors.length === 0) {
        return NextResponse.json({ error: "No MFA factors found" }, { status: 400, headers: actionHeaders });
      }

      const targetFactor = factorId ? totpFactors.find(f => f.id === factorId) : totpFactors[0];
      if (!targetFactor) return NextResponse.json({ error: 'Factor not found' }, { status: 404, headers: actionHeaders });

      const { error: unregisterError } = await supabase.auth.mfa.unenroll({
        factorId: targetFactor.id
      });

      if (unregisterError) {
        console.error('[MFA][disable] unenroll error:', { userId: user.id, ip, error: unregisterError });
        return NextResponse.json({ error: 'Failed to unenroll factor' }, { status: 400, headers: actionHeaders });
      }

      // Record an audit-like entry in system_audit_logs (use user id as actor to preserve trace)
      try {
        const adminSupabase = (await import('@supabase/supabase-js')).createClient(
          getEnv().NEXT_PUBLIC_SUPABASE_URL,
          getEnv().SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        await adminSupabase.from('system_audit_logs').insert({
          admin_id: user.id,
          admin_name: user.email,
          target_id: user.id,
          target_type: 'user',
          action: 'mfa_unenrolled',
          new_value: { factorId: targetFactor.id },
          metadata: { ip, user_agent: req.headers.get('user-agent') }
        });
      } catch (auditErr) {
        console.error('[MFA][disable] audit insert failed:', auditErr);
      }

      return NextResponse.json({ 
        success: true, 
        message: "MFA disabled successfully"
      }, { headers: actionHeaders });

    } else if (action === 'generate_backup_codes') {
      const actionRate = await checkRateLimit(mfaActionLimiter, `mfa-action:${user.id || ip}`);
      const actionHeaders = buildRateLimitResponseHeaders(actionRate);
      if (!actionRate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: actionHeaders });

      // Generate user backup codes (not reversible) and attempt to persist them using service role
      try {
        const { randomBytes, createHash } = await import('crypto');
        const codes = Array.from({ length: 10 }).map(() => randomBytes(5).toString('hex').toUpperCase());

        const rows = codes.map(code => ({
          user_id: user.id,
          code_hash: createHash('sha256').update(code).digest('hex'),
          used: false,
          created_at: new Date().toISOString()
        }));

        try {
          const adminSupabase = (await import('@supabase/supabase-js')).createClient(
            getEnv().NEXT_PUBLIC_SUPABASE_URL,
            getEnv().SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
          );

          // Remove any previous codes then insert new ones
          await adminSupabase.from('system_mfa_backup_codes').delete().eq('user_id', user.id);
          await adminSupabase.from('system_mfa_backup_codes').insert(rows);
        } catch (persistErr) {
          console.error('[MFA][backup] failed to persist backup codes:', { userId: user.id, ip, error: persistErr });
          // Do not fail the request; return codes but log persistence failure for operators
        }

        return NextResponse.json({ success: true, backupCodes: codes }, { headers: actionHeaders });
      } catch (err) {
        console.error('[MFA][backup] generation error:', err);
        return NextResponse.json({ error: 'Failed to generate backup codes' }, { status: 500, headers: actionHeaders });
      }

    } else if (action === 'verify') {
      const verifyRate = await checkRateLimit(mfaVerifyLimiter, `mfa-verify:${user.id || ip}`);
      const verifyHeaders = buildRateLimitResponseHeaders(verifyRate);
      if (!verifyRate.success) return NextResponse.json({ error: 'Too many verification attempts' }, { status: 429, headers: verifyHeaders });

      const { factorId, code } = body;

      if (!factorId || !code) {
        return NextResponse.json({ error: "Factor ID and verification code are required" }, { status: 400, headers: verifyHeaders });
      }

      // Ensure factor belongs to user
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        console.error('[MFA][verify] listFactors error during verify:', { userId: user.id, ip, error: factorsError });
        return NextResponse.json({ error: 'Failed to verify factor ownership' }, { status: 500, headers: verifyHeaders });
      }

      const totpFactors = factors?.all?.filter(factor => factor.factor_type === 'totp') || [];
      const owns = totpFactors.some(f => f.id === factorId);
      if (!owns) return NextResponse.json({ error: 'Factor not found or not owned by this account' }, { status: 404, headers: verifyHeaders });

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code
      });

      if (error) {
        console.error('[MFA][verify] verify error:', { userId: user.id, ip, error });
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400, headers: verifyHeaders });
      }

      // audit enroll
      try {
        const adminSupabase = (await import('@supabase/supabase-js')).createClient(
          getEnv().NEXT_PUBLIC_SUPABASE_URL,
          getEnv().SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        await adminSupabase.from('system_audit_logs').insert({
          admin_id: user.id,
          admin_name: user.email,
          target_id: user.id,
          target_type: 'user',
          action: 'mfa_enrolled',
          new_value: { factorId },
          metadata: { ip, user_agent: req.headers.get('user-agent') }
        });
      } catch (auditErr) {
        console.error('[MFA][verify] audit insert failed:', auditErr);
      }

      return NextResponse.json({ 
        success: true, 
        message: "MFA verification successful"
      }, { headers: verifyHeaders });

    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400, headers: apiRateHeaders });
    }

  } catch (error: unknown) {
    console.error("MFA action error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
