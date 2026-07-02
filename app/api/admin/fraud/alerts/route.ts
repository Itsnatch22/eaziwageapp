import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { dbErrorResponse } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createRouteHandlerClient();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('fraud_alerts')
      .select(`
        *,
        employee:employee_id(full_name, employee_code),
        employer:employer_id(company_name)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return dbErrorResponse('admin/fraud/alerts GET', error);
    return NextResponse.json({ alerts: data });
  } catch (error: unknown) {
    return dbErrorResponse('admin/fraud/alerts GET', error);
  }
}
