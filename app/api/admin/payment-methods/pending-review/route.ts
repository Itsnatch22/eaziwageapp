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

  const { data: methods, error } = await adminSupabase
    .from('payment_methods')
    .select('id, employee_id, provider_name, account_name, verification_document_path, verification_status, verification_notes, created_at, updated_at')
    .eq('method_type', 'bank_account')
    .eq('verification_status', 'pending_review')
    .order('updated_at', { ascending: true });

  if (error) {
    return dbErrorResponse('admin/payment-methods/pending-review', error);
  }

  const employeeIds = [...new Set((methods ?? []).map((m) => m.employee_id))];
  let employeesById = new Map<string, { full_name: string | null; employer_id: string | null }>();

  if (employeeIds.length > 0) {
    const { data: employees } = await adminSupabase
      .from('employees')
      .select('id, full_name, employer_id')
      .in('id', employeeIds);
    employeesById = new Map((employees ?? []).map((e) => [e.id, { full_name: e.full_name, employer_id: e.employer_id }]));
  }

  const withUrls = await Promise.all((methods ?? []).map(async (m) => {
    let documentUrl: string | null = null;
    if (m.verification_document_path) {
      const { data: signedData } = await adminSupabase.storage
        .from(BUCKET)
        .createSignedUrl(m.verification_document_path, 60 * 60);
      documentUrl = signedData?.signedUrl ?? null;
    }
    const employee = employeesById.get(m.employee_id);
    return {
      id: m.id,
      employee_id: m.employee_id,
      employee_name: employee?.full_name ?? 'Unknown employee',
      provider_name: m.provider_name,
      account_name: m.account_name,
      verification_status: m.verification_status,
      verification_notes: m.verification_notes,
      document_url: documentUrl,
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }));

  return NextResponse.json({ methods: withUrls });
}
