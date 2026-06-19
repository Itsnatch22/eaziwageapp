import { NextRequest, NextResponse } from 'next/server';
import { createClient }               from '@supabase/supabase-js';
import { createServerClient }         from '@supabase/ssr';
import { Resend }                    from 'resend';
import { z }                         from 'zod';
import { render }                    from '@react-email/render';

import { getEnv }                    from '@/env';
import { rateLimiter, checkRateLimit } from '@/lib/rate-limit';
import { validateEmail }             from '@/lib/email-validation';
import { createToken }               from '@/lib/token';
import { getCurrencyFromCountry }     from '@/lib/utils';
import WelcomeEmail                  from '@/lib/emails/WelcomeEmail';
import { notifyAdmins, notifyEmployer } from '@/lib/notifications';

const env    = getEnv();
const resend = new Resend(env.RESEND_API_KEY);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const FROM_EMAIL   = 'EaziWage <noreply@eaziwage.com>';
const BASE_URL     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com';
const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_MIN_SCORE = 0.5;

const EmployerReferralSchema = z.object({
  employer_name:  z.string().min(2,  'Employer name must be at least 2 characters').max(20),
  employer_email: z.string().email('Invalid employer email address'),
  employer_phone: z.string().min(10, 'Employer phone number appears too short').max(20, 'Employer phone number appears too long'),
});

const RegisterSchema = z.object({
  full_name:          z
    .string()
    .min(2,   'Full name must be at least 2 characters')
    .max(20, 'Full name must be under 20 characters')
    .regex(/^[\p{L}\s'-]+$/u, 'Full name contains invalid characters'),

  email: z
    .string()
    .email('Invalid email address')
    .max(50, 'Email must be under 50 characters'),

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

async function verifyRecaptcha(token: string, remoteip: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      secret:   env.RECAPTCHA_SECRET_KEY,
      response: token,
    });
    if (remoteip && remoteip !== '0.0.0.0') params.set('remoteip', remoteip);

    let res  = await fetch(RECAPTCHA_URL, { method: 'POST', body: params });
    let data = await res.json() as { success: boolean; score?: number; 'error-codes'?: string[] };

    if (!data.success && params.has('remoteip')) {
      params.delete('remoteip');
      res = await fetch(RECAPTCHA_URL, { method: 'POST', body: params });
      data = await res.json() as { success: boolean; score?: number; 'error-codes'?: string[] };
    }

    if (!data.success) {
      console.warn('[reCAPTCHA] Verification failed:', data['error-codes']);
      return false;
    }

    if (typeof data.score !== 'number') return true;
    const score = data.score;
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

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                      ??
    req.headers.get('x-forwarded-for')?.split(',')[0]  ??
    req.headers.get('cf-connecting-ip')               ??
    '0.0.0.0'
  ).trim();
}

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
    console.error('[email] Failed to send welcome email:', error);
  }
}

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

function generateEmployerCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return random;
}

interface EmployerRecord {
  id: string;
  status: string;
  user_id: string;
  employer_code: string;
  onboarding_id: string | null;
}

interface OnboardingRecord {
  id: string;
  status: string;
  user_id: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  const rateResult = await checkRateLimit(rateLimiter, `register:${ip}`);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: rateResult.headers },
    );
  }

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

  const captchaOk = await verifyRecaptcha(input.recaptcha_token, ip);
  if (!captchaOk) {
    return NextResponse.json(
      { error: 'reCAPTCHA verification failed. Please refresh and try again.' },
      { status: 403, headers: rateResult.headers },
    );
  }

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

  let generatedEmployerCode: string | null = null;
  if (input.role === 'employer') {
    if (!input.company_name.trim()) {
      return NextResponse.json(
        { error: 'Company name is required for employer accounts' },
        { status: 422 },
      );
    }
  }

  let employerUserId: string | null = null;
  let employerOnboardingId: string | null = null;

  if (input.role === 'employee' && input.company_code) {
    const { data: employer, error: empError } = await supabase
      .from('employers')
      .select('id, status, user_id, employer_code, onboarding_id')
      .ilike('employer_code', input.company_code)
      .maybeSingle<EmployerRecord>();

    if (empError || !employer) {
      const { data: profileEmp, error: profileEmpError } = await supabase
        .from('profiles')
        .select('id, role, company_code')
        .eq('role', 'employer')
        .ilike('company_code', input.company_code)
        .maybeSingle<{ id: string; role: string; company_code: string | null }>();

      if (profileEmpError || !profileEmp) {
        return NextResponse.json(
          { error: 'Company code not found. Please search again or continue without a code.' },
          { status: 422, headers: rateResult.headers },
        );
      }

      const { data: onboardingRows } = await supabase
        .from('employer_onboarding')
        .select('id, status, user_id')
        .eq('user_id', profileEmp.id)
        .order('created_at', { ascending: false });

      const approvedOnboarding = (onboardingRows as OnboardingRecord[] | null)
        ?.find((r) => r.status === 'approved') ?? null;

      const latestOnboarding = (onboardingRows && onboardingRows.length > 0)
        ? (onboardingRows[0] as OnboardingRecord)
        : null;

      if (!approvedOnboarding) {
        // Employer exists but hasn't completed onboarding yet (no row,
        // or a row exists but isn't 'approved'). Employees may only link
        // to employers who have finished onboarding — reject rather than
        // silently registering with no employer link.
        if (latestOnboarding?.status === 'rejected' || latestOnboarding?.status === 'suspended') {
          return NextResponse.json(
            { error: `This company is currently ${latestOnboarding.status} on EaziWage. Please contact support.` },
            { status: 422, headers: rateResult.headers },
          );
        }
        return NextResponse.json(
          { error: 'This company has not finished onboarding yet. Please try again once they have completed setup, or continue without a code.' },
          { status: 422, headers: rateResult.headers },
        );
      }

      employerUserId = approvedOnboarding.user_id;
      employerOnboardingId = approvedOnboarding.id;
    } else {
        if (employer.status === 'rejected' || employer.status === 'suspended') {
            return NextResponse.json(
              { error: `This company is currently ${employer.status} on EaziWage. Please contact support.` },
              { status: 422, headers: rateResult.headers },
            );
        }
        if (employer.status !== 'approved') {
          return NextResponse.json(
            { error: 'This company has not finished onboarding yet. Please try again once they have completed setup, or continue without a code.' },
            { status: 422, headers: rateResult.headers },
          );
        }
        employerUserId = employer.user_id;
        employerOnboardingId = employer.onboarding_id;
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email:             input.email,
    password:          input.password,
    email_confirm:     true,
    user_metadata: {
      full_name:          input.full_name,
      role:               input.role,
      phone_country_code: input.phone_country_code,
    },
  });

  if (authError) {
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
  const registrationCurrency = getCurrencyFromCountry(input.phone_country_code, 'KES');

  if (input.role === 'employer') {
    generatedEmployerCode = generateEmployerCode();
    
    // Fix 1: Atomic creation of employer_onboarding row
    const { data: onboarding, error: onboardingError } = await supabase
      .from('employer_onboarding')
      .insert({
        user_id: userId,
        company_name: input.company_name || '',
        status: 'draft',
        currency: registrationCurrency,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single<{ id: string }>();

    if (onboardingError || !onboarding) {
      await supabase.auth.admin.deleteUser(userId);
      console.error('[db] employer_onboarding insert error:', onboardingError);
      return NextResponse.json(
        { error: 'Failed to create employer onboarding record. Please try again.' },
        { status: 500, headers: rateResult.headers },
      );
    }

    employerOnboardingId = onboarding.id;

    const { error: employerError } = await supabase
      .from('employers')
      .upsert({
        company_code: generatedEmployerCode,
        company_name: input.company_name || '',
        email:        input.email,
        phone:        input.phone,
        country:      input.phone_country_code,
        user_id:      userId,
        employer_id:  userId, 
        status:       'pending',
        onboarding_id: employerOnboardingId,
        created_at:   new Date().toISOString(),
      }, { onConflict: 'company_code' });

    if (employerError) {
      await supabase.from('employer_onboarding').delete().eq('id', employerOnboardingId);
      await supabase.auth.admin.deleteUser(userId);
      console.error('[db] employer insert error:', employerError);
      return NextResponse.json(
        { error: 'Failed to create employer account. Please try again.' },
        { status: 500, headers: rateResult.headers },
      );
    }
  } else if (input.role === 'employee') {
    // Fix 1: Atomic creation of employee_onboarding row
    const { error: onboardingError } = await supabase
      .from('employee_onboarding')
      .insert({
        user_id: userId,
        employer_id: employerOnboardingId,
        status: 'pending',
        full_name: input.full_name,
        email: input.email,
        country: input.phone_country_code,
        currency: registrationCurrency,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (onboardingError) {
      await supabase.auth.admin.deleteUser(userId);
      console.error('[db] employee_onboarding insert error:', onboardingError);
      return NextResponse.json(
        { error: 'Failed to create employee onboarding record. Please try again.' },
        { status: 500, headers: rateResult.headers },
      );
    }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id:                 userId,
      full_name:          input.full_name,
      email:              input.email,
      phone:              input.phone,
      phone_country_code: input.phone_country_code,
      role:               input.role,
      role_normalized:    input.role,
      company_code:       input.role === 'employee' ? (input.company_code || null) : generatedEmployerCode,
      company_name:       input.role === 'employer' ? input.company_name : null,
      email_verified:     false,
      is_active:          false, // Fix 2: Explicitly set to false initially
      onboarding_complete: false,
      created_at:         new Date().toISOString(),
    }, { onConflict: 'id' });

  if (profileError) {
    if (input.role === 'employer' && employerOnboardingId) {
      await supabase.from('employers').delete().eq('onboarding_id', employerOnboardingId);
      await supabase.from('employer_onboarding').delete().eq('id', employerOnboardingId);
    } else if (input.role === 'employee') {
      await supabase.from('employee_onboarding').delete().eq('user_id', userId);
    }
    await supabase.auth.admin.deleteUser(userId);
    console.error('[db] profile insert error:', profileError);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500, headers: rateResult.headers },
    );
  }

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
    console.error('[db] token insert error:', tokenError);
  }

  const verificationUrl = `${BASE_URL}/verify-email?token=${token}`;
  await sendWelcomeEmail(input, verificationUrl);

  if (input.employer_referral) {
    await supabase.from('employer_referrals').insert({
      referred_by_user_id: userId,
      employer_name:       input.employer_referral.employer_name,
      employer_email:      input.employer_referral.employer_email,
      employer_phone:      input.employer_referral.employer_phone,
      status:              'pending',
      created_at:          new Date().toISOString(),
    });

    await sendReferralNotification(input.employer_referral, {
      name:  input.full_name,
      email: input.email,
    });
  }

  const authRes = NextResponse.next();
  const authClient = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            authRes.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (signInError) {
    console.error('[auth] auto-signin error:', signInError);
    return NextResponse.json(
      { error: 'Account created, but automatic sign-in failed. Please sign in manually.' },
      { status: 500, headers: rateResult.headers },
    );
  }

  const successResponse = NextResponse.json(
    {
      message: 'Account created successfully.',
      userId,
      role: input.role,
    },
    { status: 201, headers: rateResult.headers },
  );

  authRes.cookies.getAll().forEach(({ name, value, ...options }) => {
    successResponse.cookies.set(name, value, options);
  });

  try {
    await notifyAdmins({
      type: input.role === 'employer' ? 'employer_kyc' : 'system_alert',
      title: `New ${input.role.charAt(0).toUpperCase() + input.role.slice(1)} Registration`,
      message: `${input.full_name} has registered as a ${input.role}.`,
      metadata: {
        user_id: userId,
        role: input.role,
        company_name: input.company_name,
      },
    });

    if (input.role === 'employee' && employerUserId) {
      await notifyEmployer({
        userId: employerUserId,
        type: 'employee',
        title: 'New Employee Registered',
        message: `${input.full_name} has registered and linked to your company.`,
      });
    }
  } catch (notifErr) {
    console.error('[register/notifications]', notifErr);
    // Non-fatal
  }

  return successResponse;
}

export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }