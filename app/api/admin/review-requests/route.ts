import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { UserRoleEnum, isAdminRole } from '@/lib/validations/kyc-validation';
import pusherServer from '@/lib/pusher-server';

export const runtime = 'nodejs';

function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyAdmin() {
  const supabase = await createRouteHandlerClient();
  const adminSupabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const roles = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
    .filter((role): role is string => typeof role === 'string' && role.length > 0)
    .map((role) => role.toLowerCase());

  if (!roles.some((role) => {
    const parsed = UserRoleEnum.safeParse(role);
    return parsed.success && isAdminRole(parsed.data);
  })) {
    return { error: 'Forbidden. Admin access required.', status: 403 };
  }

  return { user, adminSupabase };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { adminSupabase } = auth;

  // 1. Fetch Risk Review Requests
  const { data: riskRequests, error: riskError } = await adminSupabase
    .from('risk_review_requests')
    .select('*, employer_onboarding(company_name, contact_email)')
    .order('created_at', { ascending: false });

  if (riskError) console.error('Error fetching risk requests:', riskError);

  // 2. Fetch KYC Document Requests (that are pending)
  const { data: kycDocs, error: kycError } = await adminSupabase
    .from('employee_kyc_documents')
    .select('*, profiles(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (kycError) console.error('Error fetching KYC docs:', kycError);

  // 3. Combine and Format
  const formattedRisk = (riskRequests || []).map(r => ({
    id: r.id,
    type: 'risk_score',
    subject: `Risk Score Review: ${r.employer_onboarding?.company_name}`,
    employer_name: r.employer_onboarding?.company_name,
    contact_email: r.employer_onboarding?.contact_email,
    message: r.message,
    status: r.status,
    priority: 'high',
    requested_at: r.created_at,
    raw_data: r
  }));

  const formattedKyc = (kycDocs || []).map(k => ({
    id: k.id,
    type: 'kyc_review',
    subject: `KYC Review: ${k.profiles?.full_name}`,
    employee_name: k.profiles?.full_name,
    message: `Document Type: ${k.document_type}. Number: ${k.document_number || 'N/A'}`,
    status: k.status,
    priority: 'medium',
    requested_at: k.created_at,
    raw_data: k
  }));

  const allRequests = [...formattedRisk, ...formattedKyc].sort(
    (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
  );

  return NextResponse.json(allRequests);
}
