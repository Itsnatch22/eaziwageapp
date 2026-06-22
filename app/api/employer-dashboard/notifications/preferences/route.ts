import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

const getAdmin = () => {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};


export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getAdmin();
    const { data: employer, error } = await admin
      .from('employers')
      .select('notification_preferences')
      .eq('user_id', user.id)
      .single();

    if (error || !employer) {

      return NextResponse.json({
        emailNotifications: true,
        advanceAlerts: true,
        payrollReminders: true,
        weeklyReports: false,
        pushNotifications: false,
      });
    }

    return NextResponse.json(employer.notification_preferences);
  } catch (err) {
    console.error('[employer][notifications] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


export async function PUT(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { emailNotifications, advanceAlerts, payrollReminders, weeklyReports, pushNotifications } = body;


    const fields = { emailNotifications, advanceAlerts, payrollReminders, weeklyReports, pushNotifications };
    for (const [key, val] of Object.entries(fields)) {
      if (typeof val !== 'boolean') {
        return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
      }
    }

    const admin = getAdmin();
    const { error } = await admin
      .from('employers')
      .update({
        notification_preferences: fields,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('[employer][notifications] update error:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 400 });
    }

    return NextResponse.json({ success: true, preferences: fields });
  } catch (err) {
    console.error('[employer][notifications] PUT error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}