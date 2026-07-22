import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { z }                         from 'zod';

import { getEnv }                      from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { unlockUserAccount }           from '@/lib/unlock-account';
import { verifyUnlockToken }           from '@/lib/unlock-token';

const env = getEnv();

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const RECAPTCHA_URL       = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_MIN_SCORE = 0.5;

const UnlockSchema = z
  .object({
    token: z.string().min(1).optional(),
    email: z.string().email('Please enter a valid email address').max(254).optional(),
    recaptcha_token: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.token || data.email), {
    message: 'Unlock token or email is required.',
  });

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                     ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip')              ??
    '0.0.0.0'
  ).trim();
}

async function verifyRecaptcha(token: string, remoteip: string): Promise<boolean> {
  if (process.env.PLAYWRIGHT_TEST === '1' && token === '__PLAYWRIGHT_TEST__') return true;

  try {
    const params = new URLSearchParams({
      secret:   env.RECAPTCHA_SECRET_KEY,
      response: token,
    });
    if (remoteip && remoteip !== '0.0.0.0') params.set('remoteip', remoteip);

    const res  = await fetch(RECAPTCHA_URL, { method: 'POST', body: params });
    const data = await res.json() as { success: boolean; score?: number };

    if (!data.success) return false;
    if (typeof data.score !== 'number') return true;
    return data.score >= RECAPTCHA_MIN_SCORE;
  } catch (err) {
    console.error('[unlock-account] reCAPTCHA error:', err);
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  const rateResult = await checkRateLimit(apiLimiter, `unlock-account:${ip}`);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.', code: 'BAD_REQUEST' },
      { status: 400 },
    );
  }

  const parsed = UnlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Invalid request.',
        code:  'VALIDATION_ERROR',
      },
      { status: 422, headers: rateResult.headers },
    );
  }

  const { token, email, recaptcha_token: recaptchaToken } = parsed.data;

  if (token) {
    const payload = await verifyUnlockToken(token);
    if (!payload) {
      return NextResponse.json(
        {
          error: 'This unlock link is invalid or has expired. Wait for the lockout to expire or try signing in again.',
          code:  'TOKEN_INVALID',
        },
        { status: 400, headers: rateResult.headers },
      );
    }

    const result = await unlockUserAccount(
      supabase,
      payload.email,
      payload.userId,
      payload.isAdmin,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Failed to unlock account.', code: 'UNLOCK_FAILED' },
        { status: 400, headers: rateResult.headers },
      );
    }

    return NextResponse.json(
      {
        message: result.alreadyUnlocked
          ? 'Your account is already unlocked. You can sign in now.'
          : 'Your account has been unlocked. You can sign in now.',
        alreadyUnlocked: result.alreadyUnlocked ?? false,
      },
      { status: 200, headers: rateResult.headers },
    );
  }

  if (!recaptchaToken) {
    return NextResponse.json(
      { error: 'Security check is required.', code: 'RECAPTCHA_REQUIRED' },
      { status: 422, headers: rateResult.headers },
    );
  }

  const captchaOk = await verifyRecaptcha(recaptchaToken, ip);
  if (!captchaOk) {
    return NextResponse.json(
      { error: 'Security check failed. Please refresh and try again.', code: 'RECAPTCHA_FAILED' },
      { status: 403, headers: rateResult.headers },
    );
  }

  const normalizedEmail = email!.trim().toLowerCase();
  const result = await unlockUserAccount(supabase, normalizedEmail);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to unlock account.', code: 'UNLOCK_FAILED' },
      { status: 400, headers: rateResult.headers },
    );
  }

  return NextResponse.json(
    {
      message: result.alreadyUnlocked
        ? 'Your account is already unlocked. You can sign in now.'
        : 'Your account has been unlocked. You can sign in now.',
      alreadyUnlocked: result.alreadyUnlocked ?? false,
    },
    { status: 200, headers: rateResult.headers },
  );
}

export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
