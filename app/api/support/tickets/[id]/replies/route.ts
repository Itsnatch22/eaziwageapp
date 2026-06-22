import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await checkAdminAccess({ user, adminSupabase });

    const { data: ticket, error: ticketError } = await adminSupabase
      .from('support_tickets')
      .select('id, status, user_id')
      .eq('id', id)
      .maybeSingle();

    if (ticketError) throw ticketError;
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }


    if (!access.isAdmin && ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: replies, error: repliesError } = await adminSupabase
      .from('ticket_replies')
      .select('id,ticket_id,sender_id,sender_role,message,created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (repliesError) throw repliesError;

    return NextResponse.json({ ticket: ticket || null, replies: replies || [] });
  } catch (error) {
    console.error('[GET /api/support/tickets/[id]/replies] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await req.json();
    const message = (body?.message || '').toString().trim();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await checkAdminAccess({ user, adminSupabase });

    const { data: ticket, error: ticketError } = await adminSupabase
      .from('support_tickets')
      .select('id, status, user_id')
      .eq('id', id)
      .maybeSingle();

    if (ticketError) throw ticketError;
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }


    if (!access.isAdmin && ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const insert = {
      ticket_id: id,
      sender_id: user.id,
      sender_role: access.isAdmin ? 'admin' : 'user',
      message,
    };

    const { data: reply, error } = await adminSupabase
      .from('ticket_replies')
      .insert(insert)
      .select()
      .single();

    if (error) throw error;


    if (ticket.status === 'closed') {
      await adminSupabase.from('support_tickets').update({ status: 'pending' }).eq('id', id);
    }

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    console.error('[POST /api/support/tickets/[id]/replies] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
