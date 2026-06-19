import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { z } from 'zod';
import { render } from '@react-email/render';

import { getEnv } from '@/env';
import { rateLimiter, checkRateLimit } from '@/lib/rate-limit';
import { createToken } from '@/lib/token';
import SessionReauthEmail from '@/lib/emails/SessionReauthEmail';

const env = getEnv();
const resend = new Resend(env.RESEND_API_KEY);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const FROM_EMAIL = 'EaziWage Auth <noreply@eaziwage.com>';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com';
const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const Schema = z.object({
  email: z.string().email('Please enter a valid email address').max(254),
  recaptcha_token: z.string().min(1, 'reCAPTCHA token is required'),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip') ??
    '0.0.0.0'
  ).trim();
}

async function verifyRecaptcha(token: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch(RECAPTCHA_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY, response: token, remoteip: ip }),
    });
    const data = await res.json() as { success: boolean; score?: number };
    return data.success && (data.score ?? 0) >= 0.5;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  const rate = await checkRateLimit(rateLimiter, `session-magic:${ip}`);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Please wait before trying again.' }, { status: 429, headers: rate.headers });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join('; ') }, { status: 422, headers: rate.headers });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const { recaptcha_token } = parsed.data;

  const isRecaptchaValid = await verifyRecaptcha(recaptcha_token, ip);
  console.log('[send-session-magic-link] reCAPTCHA validation:', { email: normalizedEmail, ip, valid: isRecaptchaValid });
  if (!isRecaptchaValid) {
    return NextResponse.json({ error: 'Security check failed. Please refresh and try again.' }, { status: 403, headers: rate.headers });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', normalizedEmail)
    .limit(1)
    .maybeSingle<{ id: string; full_name: string | null; email: string }>();

  if (!profile) {
    // Avoid account enumeration.
    return NextResponse.json({ message: 'If an account exists for this email, a magic link has been sent.' }, { status: 200, headers: rate.headers });
  }

  // Invalidate existing outstanding tokens for the user
  const { error: invalidateError } = await supabase
    .from('password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .is('used_at', null);
  if (invalidateError) console.error('[send-session-magic-link] Error invalidating old tokens:', invalidateError.message);

  const { token, tokenHash } = createToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const { error: insertError } = await supabase
    .from('password_resets')
    .insert({ user_id: profile.id, token_hash: tokenHash, expires_at: expiresAt.toISOString(), created_at: new Date().toISOString() });

  if (insertError) {
    console.error('[send-session-magic-link] Token insert error:', insertError.message);
    return NextResponse.json({ error: 'Failed to generate magic link. Please try again.' }, { status: 500, headers: rate.headers });
  }

  const magicUrl = `${BASE_URL}/api/auth/session-login?token=${token}`; // session-login route to be implemented next

  let html: string;
  try {
    html = await render(SessionReauthEmail({ fullName: profile.full_name?.trim() || profile.email, email: profile.email, magicUrl }));
  } catch (renderError) {
    console.error('[send-session-magic-link] Email render error:', renderError);
    return NextResponse.json({ error: 'Failed to generate email. Please try again.' }, { status: 500, headers: rate.headers });
  }

  console.log('[send-session-magic-link] Sending session reauth email to:', profile.email);

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: profile.email,
    subject: 'Continue your EaziWage session',
    html,
    tags: [{ name: 'category', value: 'session-reauth' }],
  });

  if (emailError) {
    console.error('[send-session-magic-link] Email send FAILED:', { error: emailError, to: profile.email, from: FROM_EMAIL });
    return NextResponse.json({ error: 'Failed to send magic link. Please try again or contact support.' }, { status: 500, headers: rate.headers });
  }

  console.log('[send-session-magic-link] Email sent successfully:', { to: profile.email, emailId: emailData?.id });

  return NextResponse.json({ message: 'If an account exists for this email, a magic link has been sent.' }, { status: 200, headers: rate.headers });
}

export async function GET() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
