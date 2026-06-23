import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase } = auth;

  const { data: riskRequests, error: riskError } = await adminSupabase
    .from('risk_review_requests')
    .select('*, employer_onboarding(company_name, contact_email)')
    .order('created_at', { ascending: false });

  if (riskError) console.error('Error fetching risk requests:', riskError);

  const { data: kycDocs, error: kycError } = await adminSupabase
    .from('employee_kyc_documents')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (kycError) console.error('Error fetching KYC docs:', kycError);

  const kycUserIds = Array.from(new Set((kycDocs || [])
    .map((k: { user_id?: string | null }) => k.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)));

  let kycProfilesById: Record<string, { full_name: string | null }> = {};
  if (kycUserIds.length > 0) {
    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('id, full_name')
      .in('id', kycUserIds);

    if (profiles) {
      kycProfilesById = profiles.reduce((acc, p) => {
        if (p.id) acc[p.id] = { full_name: p.full_name ?? null };
        return acc;
      }, {} as Record<string, { full_name: string | null }>);
    }
  }

  const { data: bankRequests, error: bankError } = await adminSupabase
    .from('bank_change_requests')
    .select('*, employer_onboarding(company_name)')
    .order('created_at', { ascending: false });

  if (bankError) console.error('Error fetching bank change requests:', bankError);

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
    subject: `KYC Review: ${kycProfilesById[k.user_id]?.full_name || 'Unknown'}`,
    employee_name: kycProfilesById[k.user_id]?.full_name,
    message: `Document Type: ${k.document_type}. Number: ${k.document_number || 'N/A'}`,
    status: k.status,
    priority: 'medium',
    requested_at: k.created_at,
    raw_data: k
  }));

  const formattedBank = (bankRequests || []).map(b => ({
    id: b.id,
    type: 'bank_change',
    subject: `Bank Change Request: ${b.employer_onboarding?.company_name}`,
    employer_name: b.employer_onboarding?.company_name,
    message: `New Bank: ${b.new_bank_name}. New Account: ${b.new_account_number}`,
    status: b.status,
    priority: 'high',
    requested_at: b.created_at,
    raw_data: b
  }));

  const allRequests = [...formattedRisk, ...formattedKyc, ...formattedBank].sort(
    (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
  );

  return NextResponse.json(allRequests);
}
