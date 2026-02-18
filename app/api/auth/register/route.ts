import { NextRequest, NextResponse } from 'next/server';
import { createClient }               from '@supabase/supabase-js';
import { Resend }                    from 'resend';
import { z }                         from 'zod';
import { render }                    from '@react-email/render';

import { getEnv }                    from '@/env';
import { rateLimiter, checkRateLimit } from '@/lib/rate-limit';
import { validateEmail }             from '@/lib/email-validation';
import { createToken }               from '@/lib/token';
import WelcomeEmail                  from '@/lib/emails/WelcomeEmail';

// ─── Environment ──────────────────────────────────────────────────────────────

const env    = getEnv();
const resend = new Resend(env.RESEND_API_KEY);

// Service-role Supabase client (server-only, never exposed to client)
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Constants ────────────────────────────────────────────────────────────────

const FROM_EMAIL   = 'EaziWage <noreply@contact.eaziwage.com>';
const BASE_URL     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eaziwage.com';
const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_MIN_SCORE = 0.5;

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const EmployerReferralSchema = z.object({
  employer_name:  z.string().min(2,  'Employer name must be at least 2 characters').max(120),
  employer_email: z.string().email('Invalid employer email address'),
  employer_phone: z.string().min(10, 'Employer phone number appears too short').max(20),
});

const RegisterSchema = z.object({
  full_name:          z
    .string()
    .min(2,   'Full name must be at least 2 characters')
    .max(100, 'Full name must be under 100 characters')
    .regex(/^[\p{L}\s'-]+$/u, 'Full name contains invalid characters'),

  email: z
    .string()
    .email('Invalid email address')
    .max(254),

  phone: z
    .string()
    .min(10, 'Phone number is too short')
    .max(20, 'Phone number is too long')
    .regex(/^\+\d{9,19}$/, 'Phone must include a country code, e.g. +254700000000'),

  phone_country_code: z
    .enum(['KE', 'TZ', 'UG', 'RW'], {
      message: 'Phone country code must be one of: KE, TZ, UG, RW',
    }),

  password: z
    .string()
    .min(8,  'Password must be at least 8 characters')
    .max(72, 'Password must be under 72 characters')
    .regex(/[A-Z]/,    'Password must contain at least one uppercase letter')
    .regex(/[0-9]/,    'Password must contain at least one number'),

  role: z.enum(['employee', 'employer']),

  company_code: z.string().max(20).optional().default(''),
  company_name: z.string().max(120).optional().default(''),

  recaptcha_token: z.string().min(1, 'reCAPTCHA token is required'),

  employer_referral: EmployerReferralSchema.nullable().optional(),
});

type RegisterInput = z.infer<typeof RegisterSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verifies a reCAPTCHA v3 token with Google's API.
 * Returns true only if verification succeeds AND score >= threshold.
 */
async function verifyRecaptcha(token: string, remoteip: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      secret:   env.RECAPTCHA_SECRET_KEY,
      response: token,
      remoteip,
    });

    const res  = await fetch(RECAPTCHA_URL, { method: 'POST', body: params });
    const data = await res.json() as { success: boolean; score?: number; 'error-codes'?: string[] };

    if (!data.success) {
      console.warn('[reCAPTCHA] Verification failed:', data['error-codes']);
      return false;
    }

    const score = data.score ?? 0;
    if (score < RECAPTCHA_MIN_SCORE) {
      console.warn(`[reCAPTCHA] Score too low: ${score}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[reCAPTCHA] Request error:', err);
    return false;
  }
}

/**
 * Extracts the real client IP address, respecting common proxy headers.
 */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                      ??
    req.headers.get('x-forwarded-for')?.split(',')[0]  ??
    req.headers.get('cf-connecting-ip')               ??
    '0.0.0.0'
  ).trim();
}

/**
 * Sends the welcome + verification email via Resend using the React Email template.
 */
async function sendWelcomeEmail(
  input:           RegisterInput,
  verificationUrl: string,
): Promise<void> {
  const html = await render(
    WelcomeEmail({
      fullName:        input.full_name,
      email:           input.email,
      role:            input.role,
      verificationUrl,
      companyName:     input.company_name || undefined,
    }),
  );

  const { error } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      input.email,
    subject: `Welcome to EaziWage — please verify your email`,
    html,
    tags: [
      { name: 'category', value: 'onboarding' },
      { name: 'role',     value: input.role },
    ],
  });

  if (error) {
    // Non-fatal — user can request a resend. Log but don't throw.
    console.error('[email] Failed to send welcome email:', error);
  }
}

/**
 * Notifies the EaziWage sales/onboarding team of an employer referral via email.
 */
async function sendReferralNotification(
  referral:  NonNullable<RegisterInput['employer_referral']>,
  requester: { name: string; email: string },
): Promise<void> {
  const { error } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      'onboarding@contact.eaziwage.com',
    subject: `New employer referral from ${requester.name}`,
    html: `
      <p>A new employee registered and referred their employer for onboarding:</p>
      <ul>
        <li><strong>Referred by:</strong> ${requester.name} (${requester.email})</li>
        <li><strong>Employer Name:</strong> ${referral.employer_name}</li>
        <li><strong>Employer Email:</strong> ${referral.employer_email}</li>
        <li><strong>Employer Phone:</strong> ${referral.employer_phone}</li>
      </ul>
    `,
    tags: [{ name: 'category', value: 'employer-referral' }],
  });

  if (error) {
    console.error('[email] Failed to send referral notification:', error);
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  // ── 1. Rate limiting ────────────────────────────────────────────────────────
  const rateResult = await checkRateLimit(rateLimiter, `register:${ip}`);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: rateResult.headers },
    );
  }

  // ── 2. Parse & validate body ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join('; ');
    return NextResponse.json(
      { error: messages },
      { status: 422, headers: rateResult.headers },
    );
  }

  const input = parsed.data;

  // ── 3. reCAPTCHA v3 verification ────────────────────────────────────────────
  const captchaOk = await verifyRecaptcha(input.recaptcha_token, ip);
  if (!captchaOk) {
    return NextResponse.json(
      { error: 'reCAPTCHA verification failed. Please refresh and try again.' },
      { status: 403, headers: rateResult.headers },
    );
  }

  // ── 4. Deep email validation (disposable / typo / DNS MX check) ─────────────
  const emailValidation = await validateEmail(input.email, true);
  if (!emailValidation.valid) {
    return NextResponse.json(
      {
        error:      emailValidation.error ?? 'Invalid email address',
        suggestion: emailValidation.suggestion,
      },
      { status: 422, headers: rateResult.headers },
    );
  }

  // ── 5. Employer-specific: validate company_name present ─────────────────────
  if (input.role === 'employer' && !input.company_name.trim()) {
    return NextResponse.json(
      { error: 'Company name is required for employer accounts' },
      { status: 422 },
    );
  }

  // ── 6. Employee-specific: validate company_code exists (if provided) ─────────
  if (input.role === 'employee' && input.company_code) {
    const { data: employer, error: empError } = await supabase
      .from('employers')
      .select('id, status')
      .eq('company_code', input.company_code.toUpperCase())
      .single();

    if (empError || !employer) {
      return NextResponse.json(
        { error: 'Company code not found. Please search again or continue without a code.' },
        { status: 422, headers: rateResult.headers },
      );
    }

    if (employer.status !== 'approved') {
      return NextResponse.json(
        { error: 'This company is not yet approved on EaziWage.' },
        { status: 422, headers: rateResult.headers },
      );
    }
  }

  // ── 7. Create Supabase Auth user ────────────────────────────────────────────
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email:             input.email,
    password:          input.password,
    email_confirm:     false,   // We handle verification ourselves
    user_metadata: {
      full_name:          input.full_name,
      role:               input.role,
      phone_country_code: input.phone_country_code,
    },
  });

  if (authError) {
    // Supabase returns a specific message for duplicate emails
    if (authError.message.toLowerCase().includes('already registered') || authError.status === 422) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409, headers: rateResult.headers },
      );
    }
    console.error('[auth] createUser error:', authError);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500, headers: rateResult.headers },
    );
  }

  const userId = authData.user.id;

  // ── 8. Insert profile row ────────────────────────────────────────────────────
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id:                 userId,
      full_name:          input.full_name,
      email:              input.email,
      phone:              input.phone,
      phone_country_code: input.phone_country_code,
      role:               input.role,
      company_code:       input.role === 'employee' ? (input.company_code || null) : null,
      company_name:       input.role === 'employer' ? input.company_name : null,
      email_verified:     false,
      created_at:         new Date().toISOString(),
    });

  if (profileError) {
    // Roll back the auth user to avoid orphaned accounts
    await supabase.auth.admin.deleteUser(userId);
    console.error('[db] profile insert error:', profileError);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500, headers: rateResult.headers },
    );
  }

  // ── 9. Create email verification token ──────────────────────────────────────
  const { token, tokenHash } = createToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

  const { error: tokenError } = await supabase
    .from('email_verifications')
    .insert({
      user_id:    userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });

  if (tokenError) {
    // Non-fatal — user can request resend. Log and continue.
    console.error('[db] token insert error:', tokenError);
  }

  const verificationUrl = `${BASE_URL}/verify-email?token=${token}`;

  // ── 10. Send welcome email ───────────────────────────────────────────────────
  await sendWelcomeEmail(input, verificationUrl);

  // ── 11. Handle employer referral ────────────────────────────────────────────
  if (input.employer_referral) {
    // Persist referral for the sales team
    await supabase.from('employer_referrals').insert({
      referred_by_user_id: userId,
      employer_name:       input.employer_referral.employer_name,
      employer_email:      input.employer_referral.employer_email,
      employer_phone:      input.employer_referral.employer_phone,
      status:              'pending',
      created_at:          new Date().toISOString(),
    });

    // Notify the onboarding team
    await sendReferralNotification(input.employer_referral, {
      name:  input.full_name,
      email: input.email,
    });
  }

  // ── 12. Success ──────────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      message:  'Account created successfully. Please check your email to verify your account.',
      userId,
      role:     input.role,
    },
    { status: 201, headers: rateResult.headers },
  );
}

// Reject non-POST methods cleanly
export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }