import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { createServerClient }        from '@supabase/ssr';
import { Resend }                    from 'resend';
import { render }                    from '@react-email/render';

import { getEnv }                        from '@/env';
import { sendLoginNotification }         from '@/lib/security-alerts';
import type { LoginContext }             from '@/lib/security-alerts';
import WelcomeEmail                      from '@/lib/emails/WelcomeEmail';

// ─── Environment ──────────────────────────────────────────────────────────────

const env    = getEnv();
const resend = new Resend(env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Constants ────────────────────────────────────────────────────────────────

const FROM_EMAIL = 'EaziWage <noreply@contact.eaziwage.com>';
const BASE_URL   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eaziwageapp.vercel.app';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                     ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip')              ??
    '0.0.0.0'
  ).trim();
}

/**
 * Sends the welcome email for new Google sign-ups.
 * Google accounts are pre-verified so we skip the email-verification
 * step and link them directly to the dashboard.
 */
async function sendGoogleWelcomeEmail(
  fullName: string,
  email:    string,
  role:     'employee' | 'employer',
): Promise<void> {
  const dashboardUrl =
    role === 'employer'
      ? `${BASE_URL}/dashboards/employer-dashboard`
      : `${BASE_URL}/dashboards/employee-dashboard`;

  const html = await render(
    WelcomeEmail({
      fullName,
      email,
      role,
      // For Google users we send them straight to their dashboard, not a verify link
      verificationUrl: dashboardUrl,
    }),
  );

  const { error } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      email,
    subject: `Welcome to EaziWage, ${fullName.split(' ')[0]}!`,
    html,
    tags: [
      { name: 'category', value: 'onboarding'    },
      { name: 'provider', value: 'google'         },
      { name: 'role',     value: role             },
    ],
  });

  if (error) console.error('[google-callback] Welcome email failed:', error);
}

// ─── Route Handler ─────────────────────────────────────────────────────────────
//
// This endpoint is called in two situations:
//
//   1. Standard PKCE code exchange (GET):
//      Supabase redirects the browser here after Google OAuth with ?code=…
//      We exchange the code, create/update the profile, and redirect the user.
//
//   2. Post-callback profile setup (GET ?setup=1):
//      AuthCallbackPage redirects here when a session exists but no profile row
//      was found (race condition on first Google sign-up). We create the profile
//      and redirect the user to onboarding.

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip          = getClientIp(req);
  const userAgent   = req.headers.get('user-agent') ?? 'Unknown';
  const searchParams = req.nextUrl.searchParams;

  const code        = searchParams.get('code');
  const isSetup     = searchParams.get('setup') === '1';
  const oauthError  = searchParams.get('error');
  const requestedRoleParam = searchParams.get('role');
  const requestedRole = requestedRoleParam === 'employer' || requestedRoleParam === 'employee' ? requestedRoleParam : null;

  // ── OAuth denial ─────────────────────────────────────────────────────────────
  if (oauthError) {
    const desc = searchParams.get('error_description') ?? oauthError;
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(desc)}`, req.url),
    );
  }

  // Build SSR-aware Supabase client that writes session cookies onto the response
  const response = NextResponse.redirect(new URL('/', req.url)); // default fallback
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ── Branch: profile setup after first OAuth (setup=1) ────────────────────────
  if (isSetup) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const user     = session.user;
    const fullName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User';
    const email    = user.email ?? '';
    const role     = (requestedRole as 'employee' | 'employer' | null) ?? (user.user_metadata?.role as 'employee' | 'employer') ?? 'employee';
    const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

    // Upsert profile — safe to call multiple times
    await supabaseAdmin.from('profiles').upsert(
      {
        id:                 user.id,
        full_name:          fullName,
        email,
        phone:              user.user_metadata?.phone ?? '',
        phone_country_code: user.user_metadata?.phone_country_code ?? 'KE',
        role,
        email_verified:     true,   // Google accounts are pre-verified
        onboarding_complete: false,
        avatar_url:         avatarUrl ?? null,
        created_at:         new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: false },
    );

    await sendGoogleWelcomeEmail(fullName, email, role);

    const onboardingUrl = role === 'employer' ? '/employer/onboarding' : '/employee/onboarding';
    const redirect = NextResponse.redirect(new URL(onboardingUrl, req.url));
    response.cookies.getAll().forEach(({ name, value, ...opts }) => redirect.cookies.set(name, value, opts));
    return redirect;
  }

  // ── Branch: standard PKCE code exchange ──────────────────────────────────────
  if (!code) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    console.error('[google-callback] Code exchange failed:', exchangeError);
    return NextResponse.redirect(
      new URL('/?error=auth_failed', req.url),
    );
  }

  const { user, session } = data;
  const loginCtx: LoginContext = { ip, userAgent, timestamp: new Date() };

  // ── Check whether this is a first-time Google sign-in ────────────────────────
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, onboarding_complete, full_name, failed_login_attempts')
    .eq('id', user.id)
    .single<{
      id:                    string;
      role:                  string;
      onboarding_complete:   boolean;
      full_name:             string;
      failed_login_attempts: number;
    }>();

  const isNewUser = !existingProfile;

  if (isNewUser) {
    // ── New Google user: create profile ────────────────────────────────────────
    const fullName  = user.user_metadata?.full_name  ?? user.email?.split('@')[0] ?? 'User';
    const email     = user.email ?? '';
    const role      = (requestedRole as 'employee' | 'employer' | null) ?? (user.user_metadata?.role as 'employee' | 'employer') ?? 'employee';
    const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

    await supabaseAdmin.from('profiles').insert({
      id:                 user.id,
      full_name:          fullName,
      email,
      phone:              user.user_metadata?.phone ?? '',
      phone_country_code: user.user_metadata?.phone_country_code ?? 'KE',
      role,
      email_verified:     true,
      onboarding_complete: false,
      avatar_url:         avatarUrl ?? null,
      created_at:         new Date().toISOString(),
    });

    await sendGoogleWelcomeEmail(fullName, email, role);

    // Persist first login event
    await supabaseAdmin.from('login_events').insert({
      user_id:    user.id,
      ip_address: ip,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    });

    const onboardingUrl = role === 'employer' ? '/employer-dashboard/onboarding' : '/employee-dashboard/onboarding';
    const redirect = NextResponse.redirect(new URL(onboardingUrl, req.url));
    response.cookies.getAll().forEach(({ name, value, ...opts }) => redirect.cookies.set(name, value, opts));
    return redirect;
  }

  // ── Returning Google user ─────────────────────────────────────────────────────
  // Reset any failed attempts (they may have been locked out via password before switching to Google)
  await supabaseAdmin
    .from('profiles')
    .update({ failed_login_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  // New-device detection
  const { data: lastLogin } = await supabaseAdmin
    .from('login_events')
    .select('user_agent')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single<{ user_agent: string }>();

  const isNewDevice = !lastLogin || lastLogin.user_agent !== userAgent;

  sendLoginNotification(
    user.email ?? '',
    existingProfile.full_name,
    loginCtx,
    isNewDevice,
  ).catch((err) => console.error('[google-callback] Login notification failed:', err));

  await supabaseAdmin.from('login_events').insert({
    user_id:    user.id,
    ip_address: ip,
    user_agent: userAgent,
    created_at: new Date().toISOString(),
  });

  // ── Role-based redirect ───────────────────────────────────────────────────────
  let destination: string;

  if (!existingProfile.onboarding_complete) {
    destination = existingProfile.role === 'employer'
      ? '/employer-dashboard/onboarding'
      : '/employee-dashboard/onboarding';
  } else {
    switch (existingProfile.role) {
      case 'admin':    destination = '/admin';                         break;
      case 'employer': destination = '/dashboards/employer-dashboard'; break;
      case 'employee': destination = '/dashboards/employee-dashboard'; break;
      default:         destination = '/';
    }
  }

  const redirect = NextResponse.redirect(new URL(destination, req.url));
  response.cookies.getAll().forEach(({ name, value, ...opts }) => redirect.cookies.set(name, value, opts));
  return redirect;
}

export async function POST() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()  { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
