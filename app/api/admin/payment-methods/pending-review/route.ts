import { NextRequest, NextResponse } from 'next/server';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

const BUCKET = 'employee-kyc-documents';

export async function GET(req: NextRequest) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase } = auth;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '25', 10)));
  const employerId = url.searchParams.get('employer_id');
  const q = url.searchParams.get('q')?.trim();

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Base filter
  let query = adminSupabase
    .from('payment_methods')
    .select('id, employee_id, provider_name, account_name, verification_document_path, verification_status, verification_notes, verification_metadata, verification_document_hash, created_at, updated_at', { count: 'exact' })
    .eq('method_type', 'bank_account')
    .eq('verification_status', 'pending_review')
    .order('updated_at', { ascending: true });

  if (q) {
    // search provider_name OR account_name
    const ilikeExpr = `%${q.replace(/%/g, '\%')}%`;
    query = query.or(`provider_name.ilike.${ilikeExpr},account_name.ilike.${ilikeExpr}`);
  }

  // If employer filter present, resolve employee IDs first and filter by employee_id
  if (employerId) {
    const { data: empRows } = await adminSupabase
      .from('employees')
      .select('id')
      .eq('employer_id', employerId);
    const employeeIds = (empRows ?? []).map((r) => (r as Record<string, unknown>)['id'] as string);
    if (employeeIds.length === 0) {
      return NextResponse.json({ methods: [], meta: { page, perPage, total: 0 } });
    }
    query = query.in('employee_id', employeeIds);
  }

  const { data: methods, error, count } = await query.range(from, to);
  if (error) return dbErrorResponse('admin/payment-methods/pending-review', error);

  const employeeIds = [...new Set((methods ?? []).map((m) => (m as Record<string, unknown>)['employee_id'] as string))];
  let employeesById = new Map<string, { full_name: string | null; employer_id: string | null }>();

  if (employeeIds.length > 0) {
    const { data: employees } = await adminSupabase
      .from('employees')
      .select('id, full_name, employer_id')
      .in('id', employeeIds);
    employeesById = new Map((employees ?? []).map((e) => [e.id, { full_name: e.full_name, employer_id: e.employer_id }]));
  }

  const withUrls = await Promise.all((methods ?? []).map(async (m) => {
    const row = m as Record<string, unknown>;
    let documentUrl: string | null = null;
    const vpath = row['verification_document_path'] as string | undefined;
    if (vpath) {
      const { data: signedData } = await adminSupabase.storage
        .from(BUCKET)
        .createSignedUrl(vpath, 60 * 60);
      documentUrl = signedData?.signedUrl ?? null;
    }
    const employee = employeesById.get(row['employee_id'] as string);
    return {
      id: row['id'] as string,
      employee_id: row['employee_id'] as string,
      employee_name: employee?.full_name ?? 'Unknown employee',
      provider_name: row['provider_name'] as string,
      account_name: row['account_name'] as string | null,
      verification_status: row['verification_status'] as string,
      verification_notes: row['verification_notes'] as string | null,
      verification_metadata: row['verification_metadata'] ?? null,
      verification_document_hash: row['verification_document_hash'] ?? null,
      document_url: documentUrl,
      created_at: row['created_at'] as string,
      updated_at: row['updated_at'] as string,
    };
  }));

  return NextResponse.json({ methods: withUrls, meta: { page, perPage, total: count ?? 0 } });
}
