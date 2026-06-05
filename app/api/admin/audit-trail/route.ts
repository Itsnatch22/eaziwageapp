import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function toIsoBoundary(dateValue: string, endOfDay: boolean): string {
  const normalized = dateValue.includes('T')
    ? dateValue
    : `${dateValue}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function buildDescription(log: {
  action?: string | null;
  reason?: string | null;
  target_type?: string | null;
  target_id?: string | null;
}): string | undefined {
  if (log.reason) return log.reason;
  if (log.action) return log.action.replace(/_/g, ' ');
  if (log.target_type && log.target_id) return `${log.target_type} ${log.target_id}`;
  if (log.target_type) return log.target_type;
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await checkAdminAccess({ user, adminSupabase });
    if (!access.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limitRaw = parseInt(searchParams.get('limit') || '50', 10);
    const skipRaw = parseInt(searchParams.get('skip') || '0', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
    const skip = Number.isFinite(skipRaw) ? Math.max(skipRaw, 0) : 0;

    const auditType = searchParams.get('audit_type')?.trim() || '';
    const settingsType = searchParams.get('settings_type')?.trim() || '';
    const changedBy = searchParams.get('changed_by')?.trim() || '';
    const startDate = searchParams.get('start_date')?.trim() || '';
    const endDate = searchParams.get('end_date')?.trim() || '';

    let query = adminSupabase
      .from('system_audit_logs')
      .select('id, admin_id, admin_name, target_id, target_type, action, reason, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    const typeFilter = auditType || settingsType;
    if (typeFilter) {
      query = query.eq('target_type', typeFilter);
    }
    if (changedBy) {
      query = query.eq('admin_id', changedBy);
    }
    if (startDate) {
      query = query.gte('created_at', toIsoBoundary(startDate, false));
    }
    if (endDate) {
      query = query.lte('created_at', toIsoBoundary(endDate, true));
    }

    const { data: logs, error, count } = await query;
    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return NextResponse.json({ logs: [], total: 0 });
      }
      throw error;
    }

    const employerIds = (logs || [])
      .filter((log) => log.target_type === 'employer_settings' && log.target_id)
      .map((log) => log.target_id as string);
    const employeeIds = (logs || [])
      .filter((log) => log.target_type === 'employee_settings' && log.target_id)
      .map((log) => log.target_id as string);

    const employerMap = new Map<string, string>();
    const employeeMap = new Map<string, { name: string; employer_id?: string | null }>();

    if (employerIds.length > 0) {
      const { data: employers } = await adminSupabase
        .from('employers')
        .select('id, company_name')
        .in('id', employerIds);
      (employers || []).forEach((row) => {
        if (row?.id) employerMap.set(row.id, row.company_name || 'Unknown');
      });
    }

    if (employeeIds.length > 0) {
      const { data: employees } = await adminSupabase
        .from('employee_onboarding')
        .select('id, full_name, employer_id')
        .in('id', employeeIds);
      (employees || []).forEach((row) => {
        if (row?.id) {
          employeeMap.set(row.id, { name: row.full_name || 'Unknown', employer_id: row.employer_id });
        }
      });
    }

    const formatted = (logs || []).map((log) => {
      const employee = log.target_id ? employeeMap.get(log.target_id) : undefined;
      const employerName = log.target_id ? employerMap.get(log.target_id) : undefined;
      const employeeEmployerName = employee?.employer_id ? employerMap.get(employee.employer_id) : undefined;

      return {
        id: log.id,
        type: log.target_type,
        description: buildDescription(log),
        changed_by_name: log.admin_name || 'Unknown',
        changed_at: log.created_at,
        employer_name: employerName || employeeEmployerName,
        employee_name: employee?.name,
      };
    });

    return NextResponse.json({ logs: formatted, total: count ?? formatted.length });
  } catch (error) {
    console.error('[GET /api/admin/audit-trail] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
