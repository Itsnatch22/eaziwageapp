import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { createServerClient }        from '@supabase/ssr';
import { z }                         from 'zod';

import { getEnv }                          from '@/env';
import { loginLimiter, checkRateLimit }     from '@/lib/rate-limit';
import { sendAccountLockedEmail }          from '@/lib/security-alerts';
import type { LoginContext }               from '@/lib/security-alerts';
import { createUnlockToken }               from '@/lib/unlock-token';
import { handleLoginSecurity }             from '@/lib/security-service';
import { normalizeAppRole, resolveRoleFromTables } from '@/lib/server/resolve-user-role';


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

  fingerprint_visitor_id: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .optional(),
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
  const ua = req.headers.get('user-agent') ?? 'Unknown';
  // Windows 10 and 11 both report 'Windows NT 10.0' in the UA string.
  // Sec-CH-UA-Platform-Version (sent after the server advertises Accept-CH) distinguishes
  // them: major version >= 14 means Windows 11.
  if (ua.includes('Windows NT 10.0')) {
    const platformVersion = req.headers.get('sec-ch-ua-platform-version');
    if (platformVersion) {
      const major = parseInt(platformVersion.replace(/"/g, '').split('.')[0], 10);
      if (!isNaN(major) && major >= 14) return ua + '; Win11';
    }
  }
  return ua;
}

async function verifyRecaptcha(token: string, remoteip: string): Promise<boolean> {
  // Playwright E2E tests set PLAYWRIGHT_TEST=1 in the server process and send this sentinel token.
  // This bypass must never be active in production — guard on the env var, not just the token.
  if (process.env.PLAYWRIGHT_TEST === '1' && token === '__PLAYWRIGHT_TEST__') return true;

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
    const unlockToken = await createUnlockToken(email, profileId, isAdmin, LOCKOUT_MINUTES);
    await sendAccountLockedEmail(email, fullName, LOCKOUT_MINUTES, ctx, unlockToken);
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

  const rateResult = await checkRateLimit(loginLimiter, `login:${ip}`);
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

  const captchaOk = await verifyRecaptcha(input.recaptcha_token, ip);
  if (!captchaOk) {
    console.log('[login] BLOCKED: reCAPTCHA failed, IP:', ip);
    return NextResponse.json(
      { error: 'Security check failed. Please refresh and try again.' },
      { status: 403, headers: rateResult.headers },
    );
  }

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

  // system_admins is the sole source of truth for admin access — no env var shortcut
  const { data: adminLookup, error: adminLookupError } = await supabaseAdmin
    .from('system_admins')
    .select('id, full_name, email, locked_until, failed_login_attempts')
    .eq('email', input.email)
    .eq('is_admin', true)
    .maybeSingle<AdminRecord>();

  if (adminLookupError) {
    console.error('[login] system_admins query error:', adminLookupError);
  }

  const isAdmin = !!adminLookup;

  if (isAdmin) {
    adminRecord = adminLookup;
    console.log('[login] Admin found in system_admins:', adminRecord?.id);
  } else {
    console.log('[login] Querying profiles table');
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

  const lockedUntilStr = isAdmin ? adminRecord?.locked_until : profileRecord?.locked_until;
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
    } else {
      // Lock has expired — reset failed attempts so the user gets fresh attempts
      const currentId = isAdmin ? adminRecord?.id : profileRecord?.id;
      if (currentId) {
        await clearFailedAttempts(currentId, isAdmin);
        if (isAdmin && adminRecord) {
          adminRecord.failed_login_attempts = 0;
          adminRecord.locked_until = null;
        } else if (profileRecord) {
          profileRecord.failed_login_attempts = 0;
          profileRecord.locked_until = null;
        }
      }
    }
  }

  console.log('[login] Attempting Supabase auth, IP:', ip);
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
    
    const loginCtx: LoginContext = {
      ip,
      userAgent,
      timestamp: new Date(),
      fingerprintVisitorId: input.fingerprint_visitor_id,
    };
    const recordId   = isAdmin ? adminRecord?.id   : profileRecord?.id;
    const recordName = isAdmin ? (adminRecord?.full_name ?? input.email) : (profileRecord?.full_name ?? input.email);

    if (recordId) {
      console.log('[login] Recording failed attempt for:', recordId);
      await recordFailedAttempt(recordId, recordName, input.email, isAdmin, loginCtx);
    } else {
      console.log('[login] No record ID found, cannot track failed attempts');
    }

    return NextResponse.json(
      { error: 'Incorrect email or password. Please try again.' },
      { status: 401, headers: rateResult.headers },
    );
  }

  const { user } = authData;
  console.log('[login] Auth SUCCESS for user:', user.id);

  if (!isAdmin && profileRecord && !profileRecord.email_verified) {
    const authEmailVerified = Boolean(user.email_confirmed_at);
    if (authEmailVerified) {
      const { error: verifySyncError } = await supabaseAdmin
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', profileRecord.id);

      if (verifySyncError) {
        console.error('[login] failed to sync email_verified from auth user:', verifySyncError);
      } else {
        profileRecord.email_verified = true;
      }
    }
  }

  if (!isAdmin && profileRecord && !profileRecord.email_verified) {
    console.log('[login] BLOCKED: Email not verified, userId:', user.id);
    return NextResponse.json(
      {
        error: 'Please verify your email address before signing in. Check your inbox for the verification link.',
        code:  'EMAIL_NOT_VERIFIED',
      },
      { status: 403, headers: rateResult.headers },
    );
  }

  const successId = isAdmin ? (adminRecord?.id ?? user.id) : profileRecord?.id;
  if (successId) {
    console.log('[login] Clearing failed attempts for:', successId);
    await clearFailedAttempts(successId, isAdmin);
  }

  const successName = isAdmin ? (adminRecord?.full_name ?? 'System Admin') : (profileRecord?.full_name ?? input.email);
  if (successId) {
    const loginCtx: LoginContext = {
      ip,
      userAgent,
      timestamp: new Date(),
      fingerprintVisitorId: input.fingerprint_visitor_id,
    };
    
    handleLoginSecurity(successId, input.email, successName, loginCtx).catch(
      (err) => console.error('[security] handleLoginSecurity failed:', err)
    );
  }

  let responseRole: string;

  if (isAdmin) {
    responseRole = 'admin';
    console.log('[login] Role set to: admin (env admin)');
  } else if (profileRecord) {
    const normalizedRole = profileRecord.is_admin
      ? 'admin'
      : normalizeAppRole(profileRecord.role_normalized) ?? normalizeAppRole(profileRecord.role);

    if (normalizedRole) {
      responseRole = normalizedRole;
    } else {
      responseRole =
        await resolveRoleFromTables(supabaseAdmin, profileRecord.id) ??
        normalizeAppRole(user.user_metadata?.role) ??
        'employee';
    }
    console.log('[login] Role set to:', responseRole);
  } else {
    console.warn('[login] No profile found for authenticated user, userId:', user.id);
    responseRole =
      await resolveRoleFromTables(supabaseAdmin, user.id) ??
      normalizeAppRole(user.user_metadata?.role) ??
      'employee';
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
