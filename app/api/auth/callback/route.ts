import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient, type User } from '@supabase/supabase-js';

type AppRole = 'admin' | 'employer' | 'employee';

interface ProfileRecord {
  email: string | null;
  email_verified: boolean | null;
  full_name: string | null;
  role: string | null;
  role_normalized: string | null;
}

function normalizeRole(value: string | null): AppRole {
  if (value === 'admin' || value === 'employer' || value === 'employee') {
    return value;
  }

  return 'employee';
}

function sanitizeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  return value;
}

function getDefaultDestination(role: string | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'employer') return '/dashboards/employer-dashboard';
  return '/dashboards/employee-dashboard';
}

function getFallbackName(user: User): string {
  const metadataName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    [user.user_metadata?.first_name, user.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

  if (metadataName) {
    return metadataName;
  }

  if (user.email) {
    return user.email.split('@')[0];
  }

  return 'User';
}

function buildErrorRedirect(origin: string, source: string | null, error = 'AuthCallbackError') {
  const destination = source === 'register' ? '/register' : '/';
  const url = new URL(destination, origin);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const source = searchParams.get('source');
  const next = sanitizeNext(searchParams.get('next'));
  const requestedRole = normalizeRole(searchParams.get('role'));

  if (!code) {
    return buildErrorRedirect(origin, source);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {



          }
        },
      }
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error('[auth callback] exchangeCodeForSession failed:', error);
    return buildErrorRedirect(origin, source);
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('email, email_verified, full_name, role, role_normalized')
    .eq('id', data.user.id)
    .maybeSingle<ProfileRecord>();

  if (profileError) {
    console.error('[auth callback] failed to load profile:', profileError);
    return buildErrorRedirect(origin, source);
  }

  const fallbackName = getFallbackName(data.user);

  if (!profile) {
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: data.user.id,
        full_name: fallbackName,
        email: data.user.email,
        role: requestedRole,
        role_normalized: requestedRole,
        email_verified: true,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[auth callback] failed to create profile:', insertError);
      return buildErrorRedirect(origin, source);
    }
  } else {
    const updates: Partial<ProfileRecord> = {};

    if (!profile.full_name && fallbackName) {
      updates.full_name = fallbackName;
    }
    if (!profile.email && data.user.email) {
      updates.email = data.user.email;
    }
    if (!profile.role) {
      updates.role = requestedRole;
    }
    if (!profile.role_normalized) {
      updates.role_normalized = profile.role ?? requestedRole;
    }
    if (!profile.email_verified) {
      updates.email_verified = true;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', data.user.id);

      if (updateError) {
        console.error('[auth callback] failed to backfill profile:', updateError);
      }
    }
  }

  const resolvedRole =
    profile?.role_normalized ??
    profile?.role ??
    requestedRole;
  const destination = next ?? getDefaultDestination(resolvedRole);

  return NextResponse.redirect(new URL(destination, origin));
}
