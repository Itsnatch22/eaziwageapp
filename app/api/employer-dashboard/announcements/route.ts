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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer } = await adminSupabase
      .from('employer_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 403 });
    }

    // We fetch from notifications table where sender is the employer
    // or we might need a dedicated announcements table. 
    // For now, let's assume a simple fetch from a mock or dedicated table if we want to store history.
    // Let's check if there's a messaging table.
    
    const { data: announcements, error: annError } = await adminSupabase
      .from('notifications')
      .select('*')
      .eq('metadata->>sender_id', employer.id)
      .eq('type', 'announcement')
      .order('created_at', { ascending: false });

    return NextResponse.json({ announcements: announcements || [] });
  } catch (error) {
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

    const { data: employer } = await adminSupabase
      .from('employer_onboarding')
      .select('id, company_name')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 403 });
    }

    const { title, message } = await req.json();

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    const { data: employees } = await adminSupabase
      .from('employee_onboarding')
      .select('user_id')
      .eq('employer_id', employer.id)
      .not('user_id', 'is', null)
      .eq('status', 'approved');

    if (!employees || employees.length === 0) {
      return NextResponse.json({ error: 'No active employees to notify' }, { status: 400 });
    }

    const notifications = employees.map(emp => ({
      user_id: emp.user_id,
      type: 'announcement',
      title: title,
      message: message,
      read: false,
      metadata: {
        sender_id: employer.id,
        sender_name: employer.company_name,
        is_announcement: true
      }
    }));

    const { error: notifyError } = await adminSupabase
      .from('notifications')
      .insert(notifications);

    if (notifyError) throw notifyError;

    return NextResponse.json({ success: true, count: employees.length });
  } catch (error: any) {
    console.error('[Announcements API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
