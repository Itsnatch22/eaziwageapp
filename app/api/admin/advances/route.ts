
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { getCurrencyFromCountry } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  page:   z.coerce.number().int().min(0).default(0),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['pending', 'approved', 'disbursed', 'rejected', 'cancelled']).optional(),
  search: z.string().max(100).optional(),
});

interface AdvanceRow {
  id: string;
  employee_id: string;
  organization_id: string;
  amount: number | string | null;
  fee_amount: number | string | null;
  fee_percentage: number | string | null;
  net_amount: number | string | null;
  disbursement_method: string | null;
  status: string;
  created_at: string;
  requested_at: string | null;
  approved_at: string | null;
  employer_id: string;
  employees?: { id?: string; full_name?: string | null; employee_code?: string | null; country?: string | null } | null;
  employers?: { id?: string; company_name?: string | null } | null;
}

export async function GET(req: NextRequest) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    page:   searchParams.get('page')   ?? undefined,
    limit:  searchParams.get('limit')  ?? undefined,
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', detail: parsed.error.issues },
      { status: 400 },
    );
  }

  const { page, limit, status, search } = parsed.data;
  const from = page * limit;
  const to   = from + limit - 1;

  try {
    let query = supabaseAdmin
      .from('advances')
      .select(
        `id, employee_id, organization_id, amount, fee_amount, fee_percentage, net_amount,
        disbursement_method, status, created_at, requested_at, approved_at, employer_id,
        employees!advances_employee_id_fkey(id, full_name, employee_code, country),
        employers!advances_employer_id_fkey(id, company_name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);

    const { data: advances, error: advancesError, count } = await query;

    if (advancesError) {
      return dbErrorResponse('admin/advances', advancesError);
    }

    const typedAdvances = (advances ?? []) as AdvanceRow[];

    let payload = typedAdvances.map((a) => {
      const employee       = a.employees;
      const employer       = a.employers;
      const sourceCurrency = getCurrencyFromCountry(employee?.country, 'KES');

      return {
        ...a,
        currency:      sourceCurrency,
        employee_name: employee?.full_name || employee?.employee_code || 'Employee',
        employee_code: employee?.employee_code || null,
        employer_name: employer?.company_name || 'Unknown',
      };
    });

    if (search) {
      const q = search.toLowerCase();
      payload = payload.filter(
        (a) =>
          a.employee_name.toLowerCase().includes(q) ||
          (a.employee_code ?? '').toLowerCase().includes(q) ||
          a.employer_name.toLowerCase().includes(q),
      );
    }

    return NextResponse.json({
      advances: payload,
      pagination: { total: count ?? 0, page, limit, hasMore: (count ?? 0) > from + payload.length },
    });
  } catch (error: unknown) {
    console.error('[AdminAdvances] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
