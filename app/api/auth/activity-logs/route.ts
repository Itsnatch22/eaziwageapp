import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getDeviceName } from '@/lib/ua-parser';
import { ActivityLogsQuerySchema } from '@/lib/validations/route-schemas';

type LoginHistoryRow = {
  id: string;
  email: string;
  ip_address: string;
  user_agent: string | null;
  logged_in_at: string;
  success: boolean | null;
  location: string | null;
  device_fingerprint: string | null;
};

const LIMIT = 10;
const AUDIT_ACTIONS = ['mfa_enrolled', 'mfa_unenrolled', 'mfa_backup_code_used', 'password_changed'] as const;

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsedQuery = ActivityLogsQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 422 });
    }
    const page = parsedQuery.data.page;
    const to = (page + 1) * LIMIT - 1;

    const { data: logs, error: logsError, count: loginCount } = await supabase
      .from('login_history')
      .select('id, email, ip_address, user_agent, logged_in_at, location, device_fingerprint, success', { count: 'exact' })
      .eq('user_id', user.id)
      .order('logged_in_at', { ascending: false })
      .range(0, to);

    if (logsError) throw logsError;

    const adminSupabase = createAdminClient();
    const { data: auditLogs, error: auditError, count: auditCount } = await adminSupabase
      .from('system_audit_logs')
      .select('id, action, created_at, metadata', { count: 'exact' })
      .eq('target_id', user.id)
      .in('action', [...AUDIT_ACTIONS])
      .order('created_at', { ascending: false })
      .range(0, to);

    if (auditError) throw auditError;

    const formattedLoginLogs = (logs || []).map((log: LoginHistoryRow) => ({
      id: `login:${log.id}`,
      action: log.success === false ? 'failed_login' : 'login',
      created_at: log.logged_in_at,
      metadata: {
        ip: log.ip_address,
        location: log.location,
        device_fingerprint: log.device_fingerprint,
        user_agent: log.user_agent,
        device_name: getDeviceName(log.user_agent),
      }
    }));

    const formattedAuditLogs = (auditLogs || []).map((log) => ({
      id: `audit:${log.id}`,
      action: log.action,
      created_at: log.created_at,
      metadata: log.metadata ?? {},
    }));
    const mergedLogs = [...formattedLoginLogs, ...formattedAuditLogs]
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(page * LIMIT, (page + 1) * LIMIT);

    return NextResponse.json({
      logs: mergedLogs,
      total: (loginCount ?? 0) + (auditCount ?? 0),
      page,
      limit: LIMIT,
    });
  } catch (error: unknown) {
    console.error('[Activity Logs API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
