import { NextRequest, NextResponse } from 'next/server';
import { createServerClient }        from '@supabase/ssr';

import { getEnv }                      from '@/env';
import { apiLimiter, checkRateLimit }  from '@/lib/rate-limit';

// ─── Environment ──────────────────────────────────────────────────────────────

const env = getEnv();

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id:         string;
  type:       'review_request' | 'employer_kyc' | 'flagged_advance' | 'system_alert';
  title:      string;
  message:    string;
  read:       boolean;
  created_at: string;
  metadata?:  Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                     ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip')              ??
    '0.0.0.0'
  ).trim();
}

// ─── GET /api/admin/notifications ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  // ── 1. Rate limit — 100 requests per minute (general API limiter) ───────────
  const rate = await checkRateLimit(apiLimiter, `admin-notifications:${ip}`);
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait and try again.' },
      { status: 429, headers: rate.headers },
    );
  }

  // ── 2. Build SSR Supabase client (reads session from cookies) ───────────────
  const response = NextResponse.next();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in.' },
      { status: 401, headers: rate.headers },
    );
  }

  // ── 3. Verify admin role ─────────────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>();

  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.' },
      { status: 403, headers: rate.headers },
    );
  }

  // ── 4. Fetch notifications ───────────────────────────────────────────────────
  // RLS policy ensures only admins can read from this table.
  // We order by created_at descending and limit to 50 most recent.
  const { data: notifications, error: notifError } = await supabase
    .from('admin_notifications')
    .select('id, type, title, message, read, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(50);

  if (notifError) {
    console.error('[admin-notifications] Fetch error:', notifError);
    return NextResponse.json(
      { error: 'Failed to fetch notifications. Please try again.' },
      { status: 500, headers: rate.headers },
    );
  }

  return NextResponse.json(
    (notifications ?? []) as Notification[],
    { status: 200, headers: rate.headers },
  );
}

// ─── POST /api/admin/notifications — Mark notification(s) as read ─────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  // Rate limit
  const rate = await checkRateLimit(apiLimiter, `admin-notifications:${ip}`);
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: rate.headers },
    );
  }

  // Build SSR client
  const response = NextResponse.next();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse body
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const { notification_ids } = body as { notification_ids?: string[] };

  if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
    return NextResponse.json(
      { error: 'notification_ids array is required' },
      { status: 422 },
    );
  }

  // Mark as read
  const { error: updateError } = await supabase
    .from('admin_notifications')
    .update({ read: true })
    .in('id', notification_ids)
    .eq('read', false); // Only update unread ones

  if (updateError) {
    console.error('[admin-notifications] Mark read error:', updateError);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: 'Notifications marked as read' }, { status: 200 });
}

export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }