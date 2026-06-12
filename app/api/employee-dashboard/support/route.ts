import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import React from 'react';
import { sendEmail } from '@/lib/email-service';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tickets, error } = await adminSupabase
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

    // Create an in-app admin notification
    const env = getEnv();
    try {
      const notification = {
        type: 'support_ticket',
        title: `New support ticket: ${subject}`,
        message: message.length > 300 ? `${message.slice(0, 300)}...` : message,
        read: false,
        metadata: { ticket_id: ticket.id, user_id: user.id },
      } as any;

      const { error: notifError } = await adminSupabase.from('admin_notifications').insert(notification);
      if (notifError) console.error('[Support Notification Insert Error]', notifError);
    } catch (err) {
      console.error('[Support Notification Error]', err);
    }

    // Send email alerts to env ADMIN_EMAILS using Resend (sendEmail helper)
    (async () => {
      try {
        const adminEmails = (env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
        if (adminEmails.length > 0) {
          const dashboardUrl = env.NEXT_PUBLIC_APP_URL || 'https://app.eaziwage.com';
          const promises = adminEmails.map((to) =>
            sendEmail({
              to,
              subject: `[Support] ${subject}`,
              react: (
                <div>
                  <p>New support ticket from {user.email}</p>
                  <p><strong>Subject:</strong> {subject}</p>
                  <p><strong>Message:</strong> {message}</p>
                  <p>
                    <a href={`${dashboardUrl}/admin/support/tickets/${ticket.id}`}>View ticket</a>
                  </p>
                </div>
              ),
            })
          );

          const results = await Promise.allSettled(promises);
          const failed = results.filter((r) => r.status === 'rejected');
          if (failed.length) console.error('[Support Email Errors]', failed);
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
