import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { z }                         from 'zod';

import { getEnv }                      from '@/env';
import { rateLimiter, checkRateLimit } from '@/lib/rate-limit';
import { hashToken, isValidTokenFormat, isTokenExpired } from '@/lib/token';

const env = getEnv();

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const VerifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                     ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip')              ??
    '0.0.0.0'
  ).trim();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

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

  if (!isValidTokenFormat(token)) {
    return NextResponse.json(
      { error: 'Invalid verification link.', code: 'TOKEN_INVALID' },
      { status: 400, headers: rate.headers },
    );
  }

  const tokenHash = await hashToken(token);

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

  if (record.used_at) {
    return NextResponse.json(
      { error: 'This verification link has already been used.', code: 'TOKEN_INVALID' },
      { status: 400, headers: rate.headers },
    );
  }

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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({ email_verified: true })
    .eq('id', record.user_id)
    .select('role_normalized, role, full_name, email')
    .single<{ role_normalized: string; role: string; full_name: string; email: string }>();
    
  if (profileError || !profile) {
    console.error('[verify-email] Profile update error:', profileError);
    return NextResponse.json(
      { error: 'Failed to activate account. Please contact support.' },
      { status: 500, headers: rate.headers },
    );
  }

  await supabase.auth.admin.updateUserById(record.user_id, {
    email_confirm: true,
  });

  return NextResponse.json(
    { message: 'Email verified successfully.', role: profile.role_normalized || profile.role },
    { status: 200, headers: rate.headers },
  );
}

export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }