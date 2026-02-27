import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { z } from 'zod';

import { getEnv } from '@/env';
import { rateLimiter, checkRateLimit } from '@/lib/rate-limit';
import { createToken } from '@/lib/token';
import AdminVerificationEmail from '@/lib/emails/AdminVerification';

export const runtime = 'nodejs';

// ─── Init ─────────────────────────────────────────────────────────────────────

const env = getEnv();
const resend = new Resend(env.RESEND_API_KEY);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Constants ────────────────────────────────────────────────────────────────

const FROM_EMAIL = 'EaziWage Admin <admin@contact.eaziwage.com>';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eaziwage.com';
const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email, email_verified')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.email_verified) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in.' },
        { status: 409, headers: rate.headers },
      );
    } else {
      // User exists but not verified - resend verification email
      return NextResponse.json(
        { 
          error: 'An account with this email exists but is not verified. Please check your email for the verification link.',
          code: 'EMAIL_NOT_VERIFIED',
        },
        { status: 409, headers: rate.headers },
      );
    }
  }

  // ── 6. Create Supabase auth user ────────────────────────────────────────────
  const { data: authData, error: signupError } = await supabase.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: false, // We'll send our own verification email
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

  // ── 7. Create profile record ────────────────────────────────────────────────
  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    email: cleanEmail,
    role_normalized: 'admin',
    is_admin: true,
    full_name: cleanEmail.split('@')[0],
    email_verified: false,
    created_at: new Date().toISOString(),
  });

  if (profileError) {
    console.error('[Admin Signup] Profile creation error:', profileError);
    // Rollback: delete the auth user
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: 'Failed to create admin profile' },
      { status: 500, headers: rate.headers },
    );
  }

  // ── 8. Create verification token ────────────────────────────────────────────
  const { token, tokenHash } = createToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const { error: tokenError } = await supabase
    .from('email_verifications')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });

  if (tokenError) {
    console.error('[Admin Signup] Token creation error:', tokenError);
    // Don't fail the signup - admin can request new verification email
  }

  // ── 9. Send verification email ──────────────────────────────────────────────
  const verificationUrl = `${BASE_URL}/verify-email?token=${token}`;
  
  let html: string;
  try {
    html = await render(
      AdminVerificationEmail({
        fullName: cleanEmail.split('@')[0],
        email: cleanEmail,
        verificationUrl,
      }),
    );
  } catch (renderError) {
    console.error('[Admin Signup] Email render error:', renderError);
    return NextResponse.json(
      { 
        success: true,
        message: 'Admin account created, but verification email failed to send. Please contact support.',
        warning: true,
      },
      { status: 201, headers: rate.headers },
    );
  }

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: cleanEmail,
    subject: 'Verify your EaziWage admin account',
    html,
    tags: [{ name: 'category', value: 'admin-verification' }],
  });

  if (emailError) {
    console.error('[Admin Signup] Email send error:', {
      error: emailError,
      to: cleanEmail,
    });
    return NextResponse.json(
      {
        success: true,
        message: 'Admin account created, but verification email failed to send. Please request a new verification link.',
        warning: true,
      },
      { status: 201, headers: rate.headers },
    );
  }

  console.log('[Admin Signup] Success:', {
    userId,
    email: cleanEmail,
    emailId: emailData?.id,
  });

  return NextResponse.json(
    {
      success: true,
      message: 'Admin account created successfully! Please check your email to verify your account.',
    },
    { status: 201, headers: rate.headers },
  );
}