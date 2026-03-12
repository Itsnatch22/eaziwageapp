import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { DocumentStatusEnum } from '@/lib/validations/kyc-validation';
import { checkAdminAccess } from '@/lib/server/admin-auth';

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

    const adminAccess = await checkAdminAccess({ user, adminSupabase });
    if (adminAccess.error) {
      return NextResponse.json({ error: 'Failed to verify role', code: 'ROLE_CHECK_FAILED' }, { status: 500 });
    }

    if (!adminAccess.isAdmin) {
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

    // Also fetch employer onboarding applications
    let empOnboardingQuery = adminSupabase
      .from('employer_onboarding')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (status) empOnboardingQuery = empOnboardingQuery.eq('status', status);
    
    const { data: employerApps, error: empAppsError } = await empOnboardingQuery;

    // Fetch employee onboarding records (from bulk uploads or manual invites)
    let employeeOnboardingQuery = adminSupabase
      .from('employee_onboarding')
      .select(`
        *,
        employer:employer_onboarding!employer_id (
          company_name
        )
      `)
      .order('created_at', { ascending: false });

    if (status) employeeOnboardingQuery = employeeOnboardingQuery.eq('status', status);
    const { data: employeeApps } = await employeeOnboardingQuery;

    // Fetch "Unlinked" employees (registered without a company code)
    const { data: unlinkedProfiles } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('role', 'employee')
      .is('company_code', null)
      .order('created_at', { ascending: false });

    const userIds = [...new Set((documents ?? []).map((d) => d.user_id).filter(Boolean))];
    const userMap: Record<string, { full_name: string; role: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', userIds);

      (profiles ?? []).forEach((p) => {
        if (p.id) {
          userMap[p.id] = {
            full_name: p.full_name ?? 'Unknown User',
            role: p.role ?? 'employee',
          };
        }
      });
    }

    return NextResponse.json(
      {
        documents: documents ?? [],
        employerApplications: employerApps ?? [],
        employeeApplications: employeeApps ?? [],
        unlinkedEmployees: unlinkedProfiles ?? [],
        usersById: userMap,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/kyc/documents] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 });
  }
}


