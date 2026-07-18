import { NextRequest, NextResponse } from 'next/server';
import { createServerClient }        from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { getEnv }                      from '@/env';
import { adminApiLimiter, checkRateLimit }  from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import type { User } from '@supabase/supabase-js';

const env = getEnv();

interface Notification {
  id:         string;
  type:       'review_request' | 'employer_kyc' | 'flagged_advance' | 'system_alert';
  title:      string;
  message:    string;
  read:       boolean;
  created_at: string;
  metadata?:  Record<string, unknown>;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')                     ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('cf-connecting-ip')              ??
    '0.0.0.0'
  ).trim();
}

// Previously checked only system_admins — a legitimate profiles.role-based admin
// (no system_admins row) got wrongly 403'd. checkAdminAccess() checks both, matching
// every other admin route's requireAdmin()-based gate.
async function isSystemAdmin(user: User): Promise<boolean> {
  const adminSupabase = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const access = await checkAdminAccess({ user, adminSupabase });
  return access.isAdmin;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rate = await checkRateLimit(adminApiLimiter, `admin-notifications:${ip}`);
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait and try again.' },
      { status: 429, headers: rate.headers },
    );
  }

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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in.' },
      { status: 401, headers: rate.headers },
    );
  }

  const isAdmin = await isSystemAdmin(user);

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.' },
      { status: 403, headers: rate.headers },
    );
  }

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rate = await checkRateLimit(adminApiLimiter, `admin-notifications:${ip}`);
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: rate.headers },
    );
  }

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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = await isSystemAdmin(user);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  const { error: updateError } = await supabase
    .from('admin_notifications')
    .update({ read: true })
    .in('id', notification_ids)
    .eq('read', false);

  if (updateError) {
    console.error('[admin-notifications] Mark read error:', updateError);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: 'Notifications marked as read' }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
    const ip = getClientIp(req);
    const rateResult = await checkRateLimit(adminApiLimiter, `admin-notif-delete:${ip}`);
    if (!rateResult.success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const bulk = searchParams.get('all') === 'true';

    if (!id && !bulk) return NextResponse.json({ error: 'Missing ID or all=true' }, { status: 400 });

    try {
        const supabase = await createRouteHandlerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const isAdmin = await isSystemAdmin(user);
        if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const env = getEnv();
        const adminSupabase = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        if (bulk) {
            // Supabase requires a filter; use a sentinel that never matches real UUIDs to delete all rows
            const { error } = await adminSupabase.from('admin_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
        } else {
            const { error } = await adminSupabase.from('admin_notifications').delete().eq('id', id!);
            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }