import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { data: employees, error } = await adminSupabase
      .from('employees')
      .select(`
        id,
        full_name,
        email,
        status,
        risk_score,
        employer:employers!employer_id (
          id,
          company_name
        )
      `)
      .eq('status', 'Active');

    if (error) throw error;

    const { data: globalRow } = await adminSupabase
      .from('global_settings')
      .select('risk_settings')
      .eq('id', 'default')
      .maybeSingle();
    const riskSettings = (globalRow?.risk_settings as { employee_low_threshold?: number; employee_medium_threshold?: number } | null) ?? {};
    const lowThreshold = riskSettings.employee_low_threshold ?? 4.0;
    const mediumThreshold = riskSettings.employee_medium_threshold ?? 2.5;

    const formatted = (employees || []).map((emp) => {
      const employer = Array.isArray(emp.employer)
        ? emp.employer[0]
        : emp.employer as { id?: string; company_name?: string } | null;

      return {
        id:            emp.id,
        full_name:     emp.full_name || 'Unknown',
        email:         emp.email || '',
        status:        emp.status,
        risk_score:    emp.risk_score,
        risk_level:    (emp.risk_score >= lowThreshold ? 'low' : emp.risk_score >= mediumThreshold ? 'medium' : 'high') as 'low' | 'medium' | 'high',
        employer_name: employer?.company_name || 'Unlinked',
        employer_id:   employer?.id || null,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[GET /api/admin/settings/employees] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
