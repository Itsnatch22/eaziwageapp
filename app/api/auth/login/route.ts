import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { createServerClient }        from '@supabase/ssr';
import { z }                         from 'zod';

import { getEnv }                          from '@/env';
import { rateLimiter, checkRateLimit }     from '@/lib/rate-limit';
import { sendAccountLockedEmail,
         sendLoginNotification }           from '@/lib/security-alerts';
import type { LoginContext }               from '@/lib/security-alerts';


const env = getEnv();

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);


const RECAPTCHA_URL       = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_MIN_SCORE = 0.5;

const MAX_FAILED_ATTEMPTS = 5;

const LOCKOUT_MINUTES = 30;

const LoginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(254),

  password: z
    .string()
    .min(1, 'Password is required')
    .max(72),

  recaptcha_token: z
    .string()
    .min(1, 'reCAPTCHA token is required'),
});

type LoginInput = z.infer<typeof LoginSchema>;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                     ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip')              ??
    '0.0.0.0'
  ).trim();
}

function getUserAgent(req: NextRequest): string {
  return req.headers.get('user-agent') ?? 'Unknown';
}

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
      console.warn('[reCAPTCHA] Login verification failed:', data['error-codes']);
      return false;
    }
    if (typeof data.score !== 'number') return true;
    const score = data.score;
    if (score < RECAPTCHA_MIN_SCORE) {
      console.warn(`[reCAPTCHA] Login score too low: ${score}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[reCAPTCHA] Request error:', err);
    return false;
  }
}

async function recordFailedAttempt(
  profileId: string,
  fullName:  string,
  email:     string,
  isAdmin:   boolean,
  ctx:       LoginContext,
): Promise<void> {
  let currentAttempts = 0;

  if (isAdmin) {
    const { data } = await supabaseAdmin
      .from('system_admins')
      .select('failed_login_attempts')
      .eq('id', profileId)
      .single<{ failed_login_attempts: number }>();
    currentAttempts = data?.failed_login_attempts ?? 0;
  } else {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('failed_login_attempts')
      .eq('id', profileId)
      .single<{ failed_login_attempts: number }>();
    currentAttempts = data?.failed_login_attempts ?? 0;
  }

  const attempts    = currentAttempts + 1;
  const shouldLock  = attempts >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
    : null;

  const updatePayload = {
    failed_login_attempts: attempts,
    ...(shouldLock && { locked_until: lockedUntil }),
  };

  if (isAdmin) {
    await supabaseAdmin.from('system_admins').update(updatePayload).eq('id', profileId);
  } else {
    await supabaseAdmin.from('profiles').update(updatePayload).eq('id', profileId);
  }

  if (shouldLock) {
    await sendAccountLockedEmail(email, fullName, LOCKOUT_MINUTES, ctx);
  }
}

async function clearFailedAttempts(profileId: string, isAdmin: boolean): Promise<void> {
  const updatePayload = { failed_login_attempts: 0, locked_until: null };
  if (isAdmin) {
    await supabaseAdmin.from('system_admins').update(updatePayload).eq('id', profileId);
  } else {
    await supabaseAdmin.from('profiles').update(updatePayload).eq('id', profileId);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip        = getClientIp(req);
  const userAgent = getUserAgent(req);

  console.log('[login] === LOGIN ATTEMPT START ===');
  console.log('[login] IP:', ip, 'User-Agent:', userAgent.substring(0, 50));

  const rateResult = await checkRateLimit(rateLimiter, `login:${ip}`);
  if (!rateResult.success) {
    console.log('[login] BLOCKED: Rate limit exceeded for IP:', ip);
    return NextResponse.json(
      { error: 'Too many login attempts from this location. Please try again later.' },
      { status: 429, headers: rateResult.headers },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join('; ');
    return NextResponse.json(
      { error: messages },
      { status: 422, headers: rateResult.headers },
    );
  }

  const input: LoginInput = parsed.data;
  console.log('[login] Email:', input.email);

  const captchaOk = await verifyRecaptcha(input.recaptcha_token, ip);
  if (!captchaOk) {
    console.log('[login] BLOCKED: reCAPTCHA failed for', input.email);
    return NextResponse.json(
      { error: 'Security check failed. Please refresh and try again.' },
      { status: 403, headers: rateResult.headers },
    );
  }

  const adminEmails  = (env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  const isEnvAdmin   = adminEmails.includes(input.email.toLowerCase());
  
  console.log('[login] Admin check:', {
    email: input.email.toLowerCase(),
    adminEmailsCount: adminEmails.length,
    isEnvAdmin,
    firstAdminEmail: adminEmails[0] || 'none'
  });

  type AdminRecord = {
    id:                    string;
    full_name:             string | null;
    email:                 string;
    locked_until:          string | null;
    failed_login_attempts: number;
  };

  type ProfileRecord = {
    id:                    string;
    full_name:             string;
    role:                  string;
    role_normalized:       string | null;
    email_verified:        boolean;
    locked_until:          string | null;
    failed_login_attempts: number;
    is_admin:              boolean;
  };

  let adminRecord:   AdminRecord   | null = null;
  let profileRecord: ProfileRecord | null = null;

  if (isEnvAdmin) {
    console.log('[login] Querying system_admins for:', input.email);
    const { data, error } = await supabaseAdmin
      .from('system_admins')
      .select('id, full_name, email, locked_until, failed_login_attempts')
      .eq('email', input.email)
      .maybeSingle<AdminRecord>();

    if (error) {
      console.error('[login] system_admins query error:', error);
    }
    adminRecord = data ?? null;
    console.log('[login] system_admins result:', adminRecord ? 'Found' : 'Not found', adminRecord?.id);
  } else {
    console.log('[login] Querying profiles for:', input.email);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, role_normalized, email_verified, locked_until, failed_login_attempts, is_admin')
      .eq('email', input.email)
      .maybeSingle<ProfileRecord>();

    if (error) {
      console.error('[login] profiles query error:', error);
    }
    profileRecord = data ?? null;
    console.log('[login] profiles result:', profileRecord ? 'Found' : 'Not found', profileRecord?.id);
  }

  const lockedUntilStr = isEnvAdmin ? adminRecord?.locked_until : profileRecord?.locked_until;
  if (lockedUntilStr) {
    const lockExpiry = new Date(lockedUntilStr);
    if (lockExpiry > new Date()) {
      const minutesLeft = Math.ceil((lockExpiry.getTime() - Date.now()) / 60_000);
      console.log('[login] BLOCKED: Account locked for', minutesLeft, 'minutes');
      return NextResponse.json(
        {
          error: `Your account is temporarily locked due to too many failed attempts. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} or check your email to unlock it.`,
        },
        { status: 423, headers: rateResult.headers },
      );
    }
  }

  console.log('[login] Attempting Supabase auth for:', input.email);
  const res = NextResponse.next();
  const supabaseAuth = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
    email:    input.email,
    password: input.password,
  });

  if (authError || !authData.session) {
    console.log('[login] Auth FAILED:', authError?.message || 'No session');
    console.log('[login] Auth error details:', {
      code: authError?.code,
      status: authError?.status,
      message: authError?.message
    });
    
    const loginCtx: LoginContext = { ip, userAgent, timestamp: new Date() };
    const recordId   = isEnvAdmin ? adminRecord?.id   : profileRecord?.id;
    const recordName = isEnvAdmin ? (adminRecord?.full_name ?? input.email) : (profileRecord?.full_name ?? input.email);

    if (recordId) {
      console.log('[login] Recording failed attempt for:', recordId);
      await recordFailedAttempt(recordId, recordName, input.email, isEnvAdmin, loginCtx);
    } else {
      console.log('[login] No record ID found, cannot track failed attempts');
    }

    return NextResponse.json(
      { error: 'Incorrect email or password. Please try again.' },
      { status: 401, headers: rateResult.headers },
    );
  }

  const { user } = authData;
  console.log('[login] Auth SUCCESS for user:', user.id, user.email);

  if (isEnvAdmin && !adminRecord) {
    console.log('[login] Auto-provisioning system_admins for:', user.email);
    const { error: insertError } = await supabaseAdmin
      .from('system_admins')
      .insert({
        id:        user.id,
        email:     input.email,
        full_name: user.user_metadata?.full_name ?? 'System Admin',
      });

    if (insertError && insertError.code !== '23505') {
      console.error('[login] Failed to auto-provision system_admins row:', insertError);
    } else {
      console.log('[login] system_admins row created successfully');
    }

    const { data } = await supabaseAdmin
      .from('system_admins')
      .select('id, full_name, email, locked_until, failed_login_attempts')
      .eq('email', input.email)
      .maybeSingle<AdminRecord>();
    adminRecord = data ?? null;
  }

  if (!isEnvAdmin && profileRecord && !profileRecord.email_verified) {
    console.log('[login] BLOCKED: Email not verified for', input.email);
    return NextResponse.json(
      {
        error: 'Please verify your email address before signing in. Check your inbox for the verification link.',
        code:  'EMAIL_NOT_VERIFIED',
      },
      { status: 403, headers: rateResult.headers },
    );
  }

  const successId = isEnvAdmin ? (adminRecord?.id ?? user.id) : profileRecord?.id;
  if (successId) {
    console.log('[login] Clearing failed attempts for:', successId);
    await clearFailedAttempts(successId, isEnvAdmin);
  }

  if (!isEnvAdmin && profileRecord) {
    const loginCtx: LoginContext = { ip, userAgent, timestamp: new Date() };

    const { data: lastLogin } = await supabaseAdmin
      .from('login_events')
      .select('user_agent')
      .eq('user_id', profileRecord.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single<{ user_agent: string }>();

    const isNewDevice = !lastLogin || lastLogin.user_agent !== userAgent;

    sendLoginNotification(input.email, profileRecord.full_name, loginCtx, isNewDevice).catch(
      (err) => console.error('[security-alert] sendLoginNotification failed:', err),
    );

    void (async () => {
      const { error } = await supabaseAdmin.from('login_events').insert({
        user_id:    profileRecord.id,
        ip_address: ip,
        user_agent: userAgent,
        created_at: new Date().toISOString(),
      });
      if (error) console.error('[security-alert] Failed to record login event:', error);
    })();
  }

  let responseRole: string;

  if (isEnvAdmin) {
    responseRole = 'admin';
    console.log('[login] Role set to: admin (env admin)');
  } else if (profileRecord) {
    responseRole = profileRecord.is_admin
      ? 'admin'
      : (profileRecord.role_normalized || profileRecord.role || 'employee');
    console.log('[login] Role set to:', responseRole);
  } else {
    console.warn(`[login] No profile found for authenticated user ${user.email} (${user.id})`);
    responseRole = user.user_metadata?.role ?? 'employee';
    console.log('[login] Role fallback to:', responseRole);
  }
  console.log('[login] === LOGIN SUCCESS ===');
  const successResponse = NextResponse.json(
    {
      message: 'Signed in successfully.',
      role:    responseRole,
      userId:  user.id,
    },
    { status: 200, headers: rateResult.headers },
  );

  res.cookies.getAll().forEach(({ name, value, ...options }) => {
    successResponse.cookies.set(name, value, options);
  });

  return successResponse;
}

export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }