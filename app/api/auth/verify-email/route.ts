import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { Resend }                    from 'resend';
import { z }                         from 'zod';
import { render }                    from '@react-email/render';

import { getEnv }                      from '@/env';
import { rateLimiter, checkRateLimit } from '@/lib/rate-limit';
import { hashToken, isValidTokenFormat, isTokenExpired } from '@/lib/token';

// ─── Init ─────────────────────────────────────────────────────────────────────

const env    = getEnv();
const resend = new Resend(env.RESEND_API_KEY);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Constants ────────────────────────────────────────────────────────────────

const FROM_EMAIL    = 'EaziWage <noreply@contact.eaziwage.com>';
const BASE_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eaziwage.com';
const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';
const TOKEN_TTL_MS  = 24 * 60 * 60 * 1000; // 24 hours

// ─── Schemas ──────────────────────────────────────────────────────────────────

const VerifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const ResendSchema = z.object({
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

// ─── POST /api/auth/verify-email — Consume a verification token ───────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  // Rate limit — 10 token attempts per hour per IP
  const rate = await checkRateLimit(rateLimiter, `verify-email:${ip}`);
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rate.headers },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Verification token is missing or malformed.', code: 'TOKEN_INVALID' },
      { status: 422, headers: rate.headers },
    );
  }

  const { token } = parsed.data;

  // ── Validate token format before hashing ────────────────────────────────────
  if (!isValidTokenFormat(token)) {
    return NextResponse.json(
      { error: 'Invalid verification link.', code: 'TOKEN_INVALID' },
      { status: 400, headers: rate.headers },
    );
  }

  const tokenHash = hashToken(token);

  // ── Look up token ────────────────────────────────────────────────────────────
  const { data: record, error: lookupError } = await supabase
    .from('email_verifications')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .single<{ id: string; user_id: string; expires_at: string; used_at: string | null }>();

  if (lookupError || !record) {
    return NextResponse.json(
      { error: 'This verification link is invalid or has already been used.', code: 'TOKEN_INVALID' },
      { status: 400, headers: rate.headers },
    );
  }

  // Already consumed
  if (record.used_at) {
    return NextResponse.json(
      { error: 'This verification link has already been used.', code: 'TOKEN_INVALID' },
      { status: 400, headers: rate.headers },
    );
  }

  // Expired
  if (isTokenExpired(record.expires_at)) {
    return NextResponse.json(
      { error: 'This verification link has expired. Please request a new one.', code: 'TOKEN_EXPIRED' },
      { status: 400, headers: rate.headers },
    );
  }

  const { error: tokenUpdateError } = await supabase
    .from('email_verifications')
    .update({ used_at: new Date().toISOString() })
    .eq('id', record.id)
    .is('used_at', null); 

  if (tokenUpdateError) {
    console.error('[verify-email] Token update error:', tokenUpdateError);
    return NextResponse.json(
      { error: 'Failed to verify email. Please try again.' },
      { status: 500, headers: rate.headers },
    );
  }

  // FIXED: Query profile.profiles with role_normalized
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({ email_verified: true })
    .eq('id', record.user_id)
    .select('role_normalized, full_name, email')
    .single<{ role_normalized: string; full_name: string; email: string }>();
    
  if (profileError || !profile) {
    console.error('[verify-email] Profile update error:', profileError);
    return NextResponse.json(
      { error: 'Failed to activate account. Please contact support.' },
      { status: 500, headers: rate.headers },
    );
  }

  // ── Also confirm the email in Supabase Auth ───────────────────────────────────
  await supabase.auth.admin.updateUserById(record.user_id, {
    email_confirm: true,
  });

  return NextResponse.json(
    { message: 'Email verified successfully.', role: profile.role_normalized },
    { status: 200, headers: rate.headers },
  );
}

export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }