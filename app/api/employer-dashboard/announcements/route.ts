import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
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

interface AnnouncementRow {
  id: string;
  title: string;
  message: string;
  created_at: string;
  metadata: {
    announcement_id?: string;
    sender_id?: string;
    sender_name?: string;
    is_announcement?: boolean;
    [key: string]: unknown;
  } | null;
}

export async function GET() {
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

    const { data: announcementRows, error: annError } = await adminSupabase
      .from('notifications')
      .select('id, title, message, created_at, metadata')
      .eq('type', 'announcement')
      .eq('metadata->>sender_id', String(employer.id))
      .order('created_at', { ascending: false });

    if (annError) {
      throw annError;
    }

    const announcements = Array.from(
      (announcementRows ?? []).reduce<Map<string, AnnouncementRow>>((history, row) => {
        const announcement = row as AnnouncementRow;
        const historyKey =
          announcement.metadata?.announcement_id ??
          `${announcement.title}:${announcement.message}:${announcement.created_at}`;

        if (!history.has(historyKey)) {
          history.set(historyKey, announcement);
        }

        return history;
      }, new Map()).values()
    );

    return NextResponse.json({ announcements: announcements || [] });
  } catch (error: unknown) {
    console.error('[Announcements API GET Error]', error);
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

    const announcementId = randomUUID();

    const notifications = employees.map(emp => ({
      user_id: emp.user_id,
      type: 'announcement',
      title: title,
      message: message,
      read: false,
      metadata: {
        announcement_id: announcementId,
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
  } catch (error: unknown) {
    console.error('[Announcements API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
