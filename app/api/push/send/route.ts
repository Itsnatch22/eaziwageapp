import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const env = getEnv();
    const body = await req.json();
    const { userId, notification } = body; // notification: { title, body, data }
    if (!userId || !notification) return NextResponse.json({ error: 'userId and notification required' }, { status: 400 });

    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: subs } = await admin.from('system_push_subscriptions').select('subscription_payload').eq('user_id', userId).eq('active', true);
    if (!subs || subs.length === 0) return NextResponse.json({ success: true, sent: 0 });

    const webpush = await import('web-push');
    webpush.setVapidDetails(
      `mailto:${env.PUSH_VAPID_CONTACT || 'no-reply@example.com'}`,
      env.VAPID_PUBLIC_KEY || env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
      env.VAPID_PRIVATE_KEY || env.SUPABASE_PRIVATE_VAPID_KEY || ''
    );

    interface PushSubscription {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    }

    let sent = 0;
    await Promise.all(subs.map(async (row: { subscription_payload: unknown }) => {
      try {
        const payload = JSON.stringify({ title: notification.title, body: notification.body, data: notification.data || {} });
        await webpush.sendNotification(row.subscription_payload as unknown as PushSubscription, payload);
        sent += 1;
      } catch (err) {
        console.error('[push][send] send error:', err);

      }
    }));

    return NextResponse.json({ success: true, sent });
  } catch (err) {
    console.error('[push][send] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
