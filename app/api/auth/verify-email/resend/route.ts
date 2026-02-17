import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { Resend }                    from 'resend';
import { z }                         from 'zod';
import { render }                    from '@react-email/render';

import { getEnv }                                from '@/env';
import { resendLimiter, checkRateLimit }         from '@/lib/rate-limit';
import { createToken }                           from '@/lib/token';
import WelcomeEmail                              from '@/lib/emails/WelcomeEmail';

// ─── Init ─────────────────────────────────────────────────────────────────────

const env    = getEnv();
const resend = new Resend(env.RESEND_API_KEY);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Constants ────────────────────────────────────────────────────────────────

const FROM_EMAIL    = 'EaziWage <noreply@eaziwage.com>';
const BASE_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eaziwage.com';
const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';
const TOKEN_TTL_MS  = 24 * 60 * 60 * 1000; // 24 hours

// ─── Schema ───────────────────────────────────────────────────────────────────

const Schema = z.object({
  email:           z.string().email('Please enter a valid email address').max(254),
  recaptcha_token: z.string().min(1, 'reCAPTCHA token is required'),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                     ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip')              ??
    '0.0.0.0'
  ).trim();
}

async function verifyRecaptcha(token: string, ip: string): Promise<boolean> {
  try {
    const res  = await fetch(RECAPTCHA_URL, {
      method: 'POST',
      body:   new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY, response: token, remoteip: ip }),
    });
    const data = await res.json() as { success: boolean; score?: number };
    return data.success && (data.score ?? 0) >= 0.5;
  } catch { return false; }
}

// ─── POST /api/auth/verify-email/resend ──────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  // ── 1. Rate limit — uses resendLimiter: 3 resends per hour per email ─────────
  // We'll derive the key from the email after parsing, but first check by IP
  // as a spam guard before we even parse the body.
  const ipRate = await checkRateLimit(resendLimiter, `resend-verify-ip:${ip}`);
  if (!ipRate.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: ipRate.headers },
    );
  }

  // ── 2. Parse & validate ─────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join('; ') },
      { status: 422, headers: ipRate.headers },
    );
  }

  const { email, recaptcha_token } = parsed.data;

  // ── 3. Per-email rate limit (3 resends / hour) ───────────────────────────────
  const emailRate = await checkRateLimit(resendLimiter, `resend-verify-email:${email}`);
  if (!emailRate.success) {
    return NextResponse.json(
      { error: 'Verification email already sent recently. Please check your inbox or try again in an hour.' },
      { status: 429, headers: emailRate.headers },
    );
  }

  // ── 4. reCAPTCHA ────────────────────────────────────────────────────────────
  if (!(await verifyRecaptcha(recaptcha_token, ip))) {
    return NextResponse.json(
      { error: 'Security check failed. Please refresh and try again.' },
      { status: 403 },
    );
  }

  // ── 5. Look up profile ───────────────────────────────────────────────────────
  // Always return 200 to prevent email enumeration.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, email_verified')
    .eq('email', email)
    .single<{ id: string; full_name: string; email: string; role: string; email_verified: boolean }>();

  if (!profile) {
    return NextResponse.json(
      { message: 'If an unverified account exists for this email, a new verification link has been sent.' },
      { status: 200 },
    );
  }

  // Already verified — no need to resend
  if (profile.email_verified) {
    return NextResponse.json(
      { message: 'If an unverified account exists for this email, a new verification link has been sent.' },
      { status: 200 },
    );
  }

  // ── 6. Invalidate existing unused tokens for this user ───────────────────────
  await supabase
    .from('email_verifications')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .is('used_at', null);

  // ── 7. Create fresh token ────────────────────────────────────────────────────
  const { token, tokenHash } = createToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const { error: insertError } = await supabase
    .from('email_verifications')
    .insert({
      user_id:    profile.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });

  if (insertError) {
    console.error('[verify-email/resend] Token insert error:', insertError);
    return NextResponse.json(
      { error: 'Failed to generate a new verification link. Please try again.' },
      { status: 500 },
    );
  }

  // ── 8. Send email ────────────────────────────────────────────────────────────
  const verificationUrl = `${BASE_URL}/verify-email?token=${token}`;
  const role = profile.role as 'employee' | 'employer';

  const html = await render(
    WelcomeEmail({
      fullName:        profile.full_name,
      email:           profile.email,
      role,
      verificationUrl,
    }),
  );

  const { error: emailError } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      profile.email,
    subject: 'Verify your EaziWage email address',
    html,
    tags: [
      { name: 'category', value: 'email-verification' },
      { name: 'type',     value: 'resend'             },
    ],
  });

  if (emailError) {
    console.error('[verify-email/resend] Email error:', emailError);
    // Non-fatal — user gets the same success response
  }

  return NextResponse.json(
    { message: 'If an unverified account exists for this email, a new verification link has been sent.' },
    { status: 200 },
  );
}

export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }