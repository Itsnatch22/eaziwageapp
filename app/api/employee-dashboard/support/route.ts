import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';

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

    return NextResponse.json({ success: true, ticket });
  } catch (error: unknown) {
    console.error('[Support API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
