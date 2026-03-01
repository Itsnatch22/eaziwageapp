import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { DocumentStatusEnum, isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';

function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string | null }>();

    if (profileError) {
      return NextResponse.json({ error: 'Failed to verify role', code: 'ROLE_CHECK_FAILED' }, { status: 500 });
    }

    const roles = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
      .filter((role): role is string => typeof role === 'string' && role.length > 0)
      .map((role) => role.toLowerCase());

    if (!roles.some((role) => {
      const parsed = UserRoleEnum.safeParse(role);
      return parsed.success && isAdminRole(parsed.data);
    })) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const userIdParam = searchParams.get('user_id');

    let status: string | null = null;
    if (statusParam) {
      const parsed = DocumentStatusEnum.safeParse(statusParam);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid status parameter', code: 'INVALID_STATUS' }, { status: 400 });
      }
      status = parsed.data;
    }

    let query = adminSupabase
      .from('employee_kyc_documents')
      .select(
        'id,user_id,document_type,document_url,storage_path,document_number,status,reviewer_notes,reviewed_at,reviewed_by,expiry_date,created_at,updated_at'
      )
      .order('created_at', { ascending: false });

    if (userIdParam) query = query.eq('user_id', userIdParam);
    if (status) query = query.eq('status', status);

    const { data: documents, error: docsError } = await query;
    if (docsError) {
      return NextResponse.json({ error: 'Failed to load KYC documents', code: 'QUERY_ERROR' }, { status: 500 });
    }

    const userIds = [...new Set((documents ?? []).map((d) => d.user_id).filter(Boolean))];
    const employeesByUserId: Record<string, { full_name: string; employee_code: string | null }> = {};

    if (userIds.length > 0) {
      const { data: employees } = await adminSupabase
        .from('employees')
        .select('user_id, full_name, employee_code')
        .in('user_id', userIds);

      (employees ?? []).forEach((emp) => {
        if (emp.user_id) {
          employeesByUserId[emp.user_id] = {
            full_name: emp.full_name ?? 'Unknown Employee',
            employee_code: emp.employee_code ?? null,
          };
        }
      });
    }

    return NextResponse.json(
      {
        documents: documents ?? [],
        employeesByUserId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/kyc/documents] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 });
  }
}


