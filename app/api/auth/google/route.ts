import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';

const env = getEnv();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eaziwageapp.vercel.app';

function resolveRole(value: string | null): 'employee' | 'employer' | null {
  if (value === 'employee' || value === 'employer') return value;
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    return NextResponse.redirect(new URL('/?error=oauth_config_error', req.url));
  }

  const role = resolveRole(req.nextUrl.searchParams.get('role'));
  const callbackUrl = new URL('/api/auth/google/callback', APP_URL);

  if (role) {
    callbackUrl.searchParams.set('role', role);
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error || !data.url) {
    console.error('[google-start] OAuth initialization failed:', error);
    return NextResponse.redirect(new URL('/?error=google_oauth_start_failed', req.url));
  }

  return NextResponse.redirect(data.url);
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
