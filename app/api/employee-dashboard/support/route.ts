import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import React from 'react';
import { sendEmail } from '@/lib/email-service';
import AdminSupportNotification from '@/lib/emails/AdminSupportNotification';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { contactLimiter, checkRateLimit } from '@/lib/rate-limit';

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ tickets: tickets || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rate = await checkRateLimit(contactLimiter, `support:${user.id}`);
    if (!rate.success) return NextResponse.json({ error: 'Too many support requests. Please wait before submitting again.' }, { status: 429 });

    const { subject, message, category } = await req.json();

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    const { data: ticket, error: ticketError } = await adminSupabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject,
        message,
        category: category || 'general',
        status: 'open'
      })
      .select()
      .single();

    if (ticketError) throw ticketError;


    const env = getEnv();
    try {
      const notification = {
        type: 'review_request',
        title: `New support ticket: ${subject}`,
        message: message.length > 300 ? `${message.slice(0, 300)}...` : message,
        read: false,
        metadata: { ticket_id: ticket.id, user_id: user.id },
      } as Record<string, unknown>;

      const { error: notifError } = await adminSupabase.from('admin_notifications').insert(notification);
      if (notifError) console.error('[Support Notification Insert Error]', notifError);
    } catch (err) {
      console.error('[Support Notification Error]', err);
    }


    (async () => {
      try {
        const adminEmail = env.ADMIN_NOTIFICATION_EMAIL;
        if (adminEmail) {
          const dashboardUrl = env.NEXT_PUBLIC_APP_URL || 'https://app.eaziwage.com';
          await sendEmail({
            to: adminEmail,
            subject: `[Support] ${subject}`,
            react: React.createElement(AdminSupportNotification, {
              submitterEmail: user.email ?? 'Unknown Submitter',
              subject,
              message,
              ticketId: ticket.id,
              dashboardUrl,
            }),
          });
        }
      } catch (error) {
        console.error('[Support Email Error]', error);
      }
    })();

    return NextResponse.json({ success: true, ticket });
  } catch (error: unknown) {
    console.error('[Support API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
