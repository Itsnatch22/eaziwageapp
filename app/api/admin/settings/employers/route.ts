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

    const { data: employers, error } = await adminSupabase
      .from('employers')
      .select(`
        id,
        company_name,
        status,
        country,
        risk_score,
        risk_rating
      `)
      .eq('status', 'approved');

    if (error) throw error;

    const { data: counts, error: countError } = await adminSupabase
      .from('employees')
      .select('employer_id')
      .eq('status', 'Active');

    if (countError) throw countError;

    const countMap: Record<string, number> = {};
    for (const row of counts || []) {
      countMap[row.employer_id] = (countMap[row.employer_id] || 0) + 1;
    }

    const formatted = (employers || []).map((emp) => ({
      id: emp.id,
      company_name: emp.company_name,
      status: emp.status,
      country: emp.country,
      risk_score: emp.risk_score,
      risk_rating: emp.risk_rating,
      employee_count: countMap[emp.id] || 0,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[GET /api/admin/settings/employers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
