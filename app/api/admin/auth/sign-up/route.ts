import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { getEnv } from '@/env';
import { rateLimiter, checkRateLimit } from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

// ─── Init ─────────────────────────────────────────────────────────────────────

const env = getEnv();

// Service role client for user management
const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Constants ────────────────────────────────────────────────────────────────

const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';

// ─── Schema ───────────────────────────────────────────────────────────────────

const AdminSignupSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
  recaptcha_token: z
    .string()
    .min(1, 'reCAPTCHA token is required'),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      body: new URLSearchParams({ 
        secret: env.RECAPTCHA_SECRET_KEY, 
        response: token, 
        remoteip: ip 
      }),
    });
    const data = await res.json() as { success: boolean; score?: number };
    return data.success && (data.score ?? 0) >= 0.5;
  } catch {
    return false;
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  // ── 1. Rate limiting — 5 attempts per hour per IP ──────────────────────────
  const rate = await checkRateLimit(rateLimiter, `admin-signup:${ip}`);
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      { status: 429, headers: rate.headers },
    );
  }

  // ── 2. Parse & validate ─────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = AdminSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join('; ') },
      { status: 422, headers: rate.headers },
    );
  }

  const cleanEmail = parsed.data.email.trim().toLowerCase();
  const { password, recaptcha_token } = parsed.data;

  // ── 3. reCAPTCHA ────────────────────────────────────────────────────────────
  const isRecaptchaValid = await verifyRecaptcha(recaptcha_token, ip);
  if (!isRecaptchaValid) {
    return NextResponse.json(
      { error: 'Security check failed. Please refresh and try again.' },
      { status: 403, headers: rate.headers },
    );
  }

  // ── 4. Email whitelist check ────────────────────────────────────────────────
  console.log(`[Admin Signup] Attempt for email: ${cleanEmail} from IP: ${ip}`);
  const authorizedEmails = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (authorizedEmails.length === 0) {
    console.error('[Admin Signup] ADMIN_EMAILS environment variable not configured');
    return NextResponse.json(
      { error: 'Admin signup is not configured. Please contact support.' },
      { status: 500, headers: rate.headers },
    );
  }

  if (!authorizedEmails.includes(cleanEmail)) {
    return NextResponse.json(
      { error: 'Email not authorized for admin access' },
      { status: 403, headers: rate.headers },
    );
  }

  // ── 5. Check if user already exists ─────────────────────────────────────────
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, email_verified')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json(
      { error: 'An account with this email already exists. Please sign in.' },
      { status: 409, headers: rate.headers },
    );
  }

  // ── 6. Create Supabase auth user ────────────────────────────────────────────
  const { data: authData, error: signupError } = await supabaseAdmin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      role: 'admin',
      full_name: cleanEmail.split('@')[0],
    },
  });

  if (signupError || !authData.user) {
    console.error('[Admin Signup] Supabase auth error:', signupError);
    return NextResponse.json(
      { error: signupError?.message ?? 'Failed to create admin account' },
      { status: 400, headers: rate.headers },
    );
  }

  const userId = authData.user.id;

  // ── 7. Create admin record ─────────────────────────────────────────
  const { error: profileError } = await supabaseAdmin.from('system_admins').upsert(
    {
      id: userId,
      email: cleanEmail,
      role_normalized: 'admin',
      is_admin: true,
      full_name: cleanEmail.split('@')[0],
    },
    { onConflict: 'email' }
  );

  if (profileError) {
    console.error('[Admin Signup] Profile creation error:', profileError);
    // Rollback: delete the auth user
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: 'Failed to create admin profile' },
      { status: 500, headers: rate.headers },
    );
  }

  // ── 8. Establish session (Auto-Login) ───────────────────────────────────────
  const supabase = await createRouteHandlerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (signInError) {
    console.error('[Admin Signup] Auto-login error:', signInError);
    // Still return success 201 because user IS created
    return NextResponse.json(
      {
        success: true,
        message: 'Admin account created successfully! Please sign in.',
        autoLoginFailed: true,
      },
      { status: 201, headers: rate.headers },
    );
  }

  console.log('[Admin Signup] Success + Auto-Login:', {
    userId,
    email: cleanEmail,
  });

  return NextResponse.json(
    {
      success: true,
      message: 'Admin account created and authenticated successfully!',
    },
    { status: 201, headers: rate.headers },
  );
}