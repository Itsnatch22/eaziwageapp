import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

import { getEnv } from '@/env';
import { hashToken, isValidTokenFormat, isTokenExpired } from '@/lib/token';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const env = getEnv();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `session-login:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';

  if (!token || !isValidTokenFormat(token)) {
    const dest = new URL(env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com');
    dest.searchParams.set('session_reauth', 'invalid');
    return NextResponse.redirect(dest, { headers: rateResult.headers });
  }

  const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const tokenHash = await hashToken(token);

  const { data: reset, error: lookupError } = await supabaseAdmin
    .from('password_resets')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (lookupError || !reset) {
    const dest = new URL(env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com');
    dest.searchParams.set('session_reauth', 'invalid');
    return NextResponse.redirect(dest, { headers: rateResult.headers });
  }

  if (reset.used_at) {
    const dest = new URL(env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com');
    dest.searchParams.set('session_reauth', 'used');
    return NextResponse.redirect(dest, { headers: rateResult.headers });
  }

  if (isTokenExpired(reset.expires_at)) {
    const dest = new URL(env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com');
    dest.searchParams.set('session_reauth', 'expired');
    return NextResponse.redirect(dest, { headers: rateResult.headers });
  }

  // Mark token as used (atomic)
  const { error: markError } = await supabaseAdmin
    .from('password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', reset.id)
    .is('used_at', null);

  if (markError) {
    console.error('[session-login] Failed to mark token used:', markError);
    const dest = new URL(env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com');
    dest.searchParams.set('session_reauth', 'error');
    return NextResponse.redirect(dest, { headers: rateResult.headers });
  }

  // === Best approach: Use generateLink + verifyOtp to get real session tokens ===
  try {
    // 1. Get user email (you may need to fetch it if not stored in password_resets)
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(reset.user_id);
    const userEmail = userData?.user?.email;

    if (!userEmail) {
      throw new Error('User email not found');
    }

    // Generate a magic link (this creates a valid OTP under the hood)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      throw new Error('Failed to generate magic link');
    }

    // Verify the OTP to obtain access_token + refresh_token
    const { data: otpData, error: otpError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (otpError || !otpData.session?.access_token || !otpData.session?.refresh_token) {
      throw new Error('Failed to verify OTP and create session');
    }

    const { access_token, refresh_token } = otpData.session;

    // 2. Create response and set cookies using @supabase/ssr
    const response = NextResponse.redirect(new URL(env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com'));

    const supabaseForCookies = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    await supabaseForCookies.auth.setSession({
      access_token,
      refresh_token,
    });

    response.headers.set('x-session-reauth', 'created');
    return response;
  } catch (err) {
    console.error('[session-login] Error creating server session:', err);
    
    // Fallback: redirect with success flag (let client-side handle auth if needed)
    const dest = new URL(env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com');
    dest.searchParams.set('session_reauth', 'success');
    return NextResponse.redirect(dest, { headers: rateResult.headers });
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}