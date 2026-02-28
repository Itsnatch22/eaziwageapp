import { NextRequest, NextResponse }  from 'next/server';
import { createClient }               from '@supabase/supabase-js';
import { Resend }                     from 'resend';
import { z }                          from 'zod';
import { getEnv }                     from '@/env';
import { hashToken, isValidTokenFormat, isTokenExpired } from '@/lib/token';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { ResetPasswordEmail }         from '@/lib/emails/ResetPasswordEmail';

// ─── Schema ───────────────────────────────────────────────────────────────────

const ResetPasswordSchema = z.object({
  token: z
    .string()
    .min(1, 'Reset token cannot be empty.'),

  password: z
    .string()
    .min(8,   'Password must be at least 8 characters.')
    .max(128, 'Password cannot exceed 128 characters.')
    .regex(/[A-Z]/,      'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/,      'Password must contain at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.'),

  recaptcha_token: z
    .string()
    .min(1, 'reCAPTCHA token cannot be empty.'),
});

// ─── reCAPTCHA v3 verification ────────────────────────────────────────────────

async function verifyRecaptcha(token: string, secretKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ secret: secretKey, response: token }),
    });

    if (!res.ok) return false;

    const data = await res.json() as {
      success: boolean;
      score?:  number;
      action?: string;
    };

    // Require score ≥ 0.5 for password reset (higher-sensitivity action)
    return data.success && (data.score ?? 0) >= 0.5;
  } catch {
    return false;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Rate-limit by IP ────────────────────────────────────────────────────
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `reset-password:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  // ── 2. Parse + validate body ───────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.', code: 'BAD_REQUEST' },
      { status: 400 },
    );
  }

  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Invalid request.',
        code:  'VALIDATION_ERROR',
      },
      { status: 400 },
    );
  }

  const { token, password, recaptcha_token } = parsed.data;

  // ── 3. Validate token format early (saves a DB round-trip) ────────────────
  if (!isValidTokenFormat(token)) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link.', code: 'TOKEN_INVALID' },
      { status: 400 },
    );
  }

  // ── 4. Verify reCAPTCHA ────────────────────────────────────────────────────
  const env          = getEnv();
  const captchaValid = await verifyRecaptcha(recaptcha_token, env.RECAPTCHA_SECRET_KEY);

  if (!captchaValid) {
    return NextResponse.json(
      { error: 'Security check failed. Please refresh and try again.', code: 'CAPTCHA_FAILED' },
      { status: 400 },
    );
  }

  // ── 5. Supabase service-role client ───────────────────────────────────────
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ── 6. Look up the hashed token ───────────────────────────────────────────
  const tokenHash = hashToken(token);

  const { data: reset, error: lookupError } = await supabase
    .from('password_resets')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .single();

  if (lookupError || !reset) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link.', code: 'TOKEN_INVALID' },
      { status: 400 },
    );
  }

  // ── 7. Guard: already used ────────────────────────────────────────────────
  if (reset.used_at) {
    return NextResponse.json(
      { error: 'This reset link has already been used.', code: 'TOKEN_INVALID' },
      { status: 400 },
    );
  }

  // ── 8. Guard: expired (1-hour window) ─────────────────────────────────────
  if (isTokenExpired(reset.expires_at)) {
    return NextResponse.json(
      { error: 'This reset link has expired. Please request a new one.', code: 'TOKEN_EXPIRED' },
      { status: 400 },
    );
  }

  // ── 9. Update password via Supabase Auth Admin API ────────────────────────
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    reset.user_id,
    { password },
  );

  if (updateError) {
    console.error('[reset-password] Auth update failed:', updateError);
    return NextResponse.json(
      { error: 'Failed to update password. Please try again.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }

  // ── 10. Mark token as used (atomic, prevents replay) ─────────────────────
  const { error: markError } = await supabase
    .from('password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', reset.id)
    .is('used_at', null); // extra safety against race conditions

  if (markError) {
    // Password already updated — log but don't fail the response
    console.error('[reset-password] Failed to mark token used:', markError);
  }

  // ── 11. Fetch user info for the confirmation email ─────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', reset.user_id)
    .single();

  // ── 12. Send confirmation email via Resend + React Email ──────────────────
  if (profile?.email) {
    const resend = new Resend(env.RESEND_API_KEY);

    const { error: emailError } = await resend.emails.send({
      from:    'EaziWage Security <security@eaziwage.com>',
      to:      profile.email,
      subject: 'Your EaziWage password was changed',
      react:   ResetPasswordEmail({
        fullName:   profile.full_name ?? 'there',
        ip,
        userAgent:  req.headers.get('user-agent') ?? 'Unknown device',
        resetUrl:   `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com'}/forgot-password`,
      }),
    });

    if (emailError) {
      // Non-fatal — password is already updated
      console.error('[reset-password] Confirmation email failed:', emailError);
    }
  }

  // ── 13. Sign out all existing sessions for this user ─────────────────────
  await supabase.auth.admin.signOut(reset.user_id, 'global');

  return NextResponse.json(
    { success: true },
    { status: 200, headers: rateResult.headers },
  );
}
