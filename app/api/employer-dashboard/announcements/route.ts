import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { contactLimiter, checkRateLimit } from '@/lib/rate-limit';

const announcementSchema = z.object({
  title: z.string().min(1).max(200, 'Title must be 200 characters or fewer'),
  message: z.string().min(1).max(2000, 'Message must be 2000 characters or fewer'),
});

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
      .from('employers')
      .select('id, onboarding_id')
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
      .eq('metadata->>sender_id', String(employer.onboarding_id))
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

    const rate = await checkRateLimit(contactLimiter, `announcements:${user.id}`);
    if (!rate.success) return NextResponse.json({ error: 'Too many announcements. Please wait before sending another.' }, { status: 429 });

    const { data: employer } = await adminSupabase
      .from('employers')
      .select('id, onboarding_id, company_name')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = announcementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }
    const { title, message } = parsed.data;

    const { data: employees } = await adminSupabase
      .from('employee_onboarding')
      .select('user_id')
      .eq('employer_id', employer.onboarding_id)
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
        sender_id: employer.onboarding_id,
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
