// app/api/admin/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';

// Same rate limit setup as signup (copy-paste for consistency)
const rateLimits = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 min
const MAX_ATTEMPTS = 5;

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // ── Rate Limit by IP ───────────────────────────────────────────
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const record = rateLimits.get(ip) || { count: 0, lastAttempt: 0 };

    if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
      record.count = 0;
      record.lastAttempt = now;
    }

    if (record.count >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    record.count++;
    rateLimits.set(ip, record);

    // ── Body + Validation ──────────────────────────────────────────
    const body = await req.json();
    const { email, password, recaptcha_token } = body;

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── reCAPTCHA ──────────────────────────────────────────────────
    if (recaptcha_token && process.env.RECAPTCHA_SECRET_KEY) {
      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptcha_token}`,
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.success || (verifyData.score ?? 0) < 0.5) {
        return NextResponse.json({ error: 'Failed reCAPTCHA validation' }, { status: 400 });
      }
    }

    // ── Supabase Sign-In ────────────────────────────────────────────
    const supabase = await createRouteHandlerClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (signInError) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify user + role
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Failed to establish user' }, { status: 500 });
    }

    // FIXED: Query profile.profiles with role_normalized or is_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_normalized, is_admin')
      .eq('id', user.id)
      .single();

    // Check if user is admin using either is_admin flag or role_normalized
    const isAdmin = profile?.is_admin === true || profile?.role_normalized === 'admin';

    if (!profile || !isAdmin) {
      await supabase.auth.signOut(); // Revoke session if not admin
      return NextResponse.json({ error: 'Not authorized as admin' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      role: 'admin',
      message: 'Admin authenticated successfully',
    });

  } catch (error: any) {
    console.error('[Admin Login] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}