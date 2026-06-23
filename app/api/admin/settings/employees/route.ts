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
        risk_level:    (emp.risk_score >= 4 ? 'low' : emp.risk_score >= 2.5 ? 'medium' : 'high') as 'low' | 'medium' | 'high',
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
