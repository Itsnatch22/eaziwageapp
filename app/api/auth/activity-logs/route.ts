import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { getDeviceName } from '@/lib/ua-parser';

type LoginHistoryRow = {
  id: string;
  email: string;
  ip_address: string;
  user_agent: string | null;
  logged_in_at: string;
  location: string | null;
  device_fingerprint: string | null;
};

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: logs, error: logsError } = await supabase
      .from('login_history')
      .select('id, email, ip_address, user_agent, logged_in_at, location, device_fingerprint')
      .eq('user_id', user.id)
      .order('logged_in_at', { ascending: false })
      .limit(20);

    if (logsError) throw logsError;


    const formattedLogs = (logs || []).map((log: LoginHistoryRow) => ({
      action: 'login',
      created_at: log.logged_in_at,
      metadata: {
        ip: log.ip_address,
        location: log.location,
        device_fingerprint: log.device_fingerprint,
        user_agent: log.user_agent,
        device_name: getDeviceName(log.user_agent),
      }
    }));

    return NextResponse.json({ logs: formattedLogs });
  } catch (error: unknown) {
    console.error('[Activity Logs API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
