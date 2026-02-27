import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Simple in-memory rate limit (per IP) – swap for Redis in prod
const rateLimits = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 min
const MAX_ATTEMPTS = 5;

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

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
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

    // ── Email Whitelist Check ──────────────────────────────────────
    const authorizedEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase());

    if (!authorizedEmails.includes(cleanEmail)) {
      return NextResponse.json({ error: 'Email not authorized for admin access' }, { status: 403 });
    }

    // ── Supabase Sign-Up ───────────────────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user }, error: signupError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { emailRedirectTo: `${req.nextUrl.origin}/admin/admin-login` },
    });

    if (signupError) {
      console.error('[Admin Signup] Supabase error:', signupError);
      return NextResponse.json({ error: signupError.message ?? 'Signup failed' }, { status: 400 });
    }

    // FIXED: Insert into profile.profiles with role_normalized and is_admin
    await supabase.from('profiles').upsert({
      id: user!.id,
      email: cleanEmail,
      role_normalized: 'admin',  // Use role_normalized instead of role
      is_admin: true,            // Set is_admin flag
      full_name: cleanEmail.split('@')[0],
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Admin account created. Check your email to confirm.',
    });

  } catch (error: any) {
    console.error('[Admin Signup] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}