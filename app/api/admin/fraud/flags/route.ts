import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type FraudFlagStatus = 'open' | 'reviewed' | 'cleared' | 'confirmed_fraud';
type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';
type FraudFlagType =
  | 'velocity'
  | 'risk_score_threshold'
  | 'kyc_mismatch'
  | 'employer_not_linked'
  | 'unverified_payment_method'
  | 'pattern_anomaly'
  | 'manual_report';

interface FraudFlagMetadataEntry {
  flagType: FraudFlagType;
  severity: FraudSeverity;
  description: string;
  metadata?: Record<string, unknown>;
}

interface FraudFlagMetadata {
  all_flags: FraudFlagMetadataEntry[];
}

interface FraudCase {
  flagId: string;
  flagType: FraudFlagType;
  severity: FraudSeverity;
  description: string;
  triggeredBy: string;
  flagStatus: FraudFlagStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
  metadata: FraudFlagMetadata | null;
  flagCreatedAt: string;
  advanceId: string;
  advanceAmount: number;
  advanceNetAmount: number;
  advanceCurrency: string;
  disbursementMethod: string;
  requestedAt: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  kycStatus: string;
  riskScore: number | null;
  country: string;
  employerId: string;
  companyName: string;
  companyCode: string;
  employerFrozen: boolean;
}

interface FraudFlagsResponse {
  cases: FraudCase[];
  totalOpen: number;
  totalCritical: number;
}

function isFraudFlagType(value: unknown): value is FraudFlagType {
  return typeof value === 'string' && [
    'velocity', 'risk_score_threshold', 'kyc_mismatch',
    'employer_not_linked', 'unverified_payment_method',
    'pattern_anomaly', 'manual_report',
  ].includes(value);
}

function isFraudSeverity(value: unknown): value is FraudSeverity {
  return typeof value === 'string' && ['low', 'medium', 'high', 'critical'].includes(value);
}

function isFraudFlagStatus(value: unknown): value is FraudFlagStatus {
  return typeof value === 'string' && ['open', 'reviewed', 'cleared', 'confirmed_fraud'].includes(value);
}

function parseMetadata(raw: unknown): FraudFlagMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.all_flags)) return null;
  return { all_flags: obj.all_flags as FraudFlagMetadataEntry[] };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const severityParam = searchParams.get('severity');

    const statusFilter: FraudFlagStatus | null =
      statusParam && isFraudFlagStatus(statusParam) ? statusParam : null;
    const severityFilter: FraudSeverity | null =
      severityParam && isFraudSeverity(severityParam) ? severityParam : null;

    let query = adminSupabase
      .from('fraud_flags')
      .select(`
        id,
        flag_type,
        severity,
        description,
        triggered_by,
        status,
        reviewed_at,
        review_notes,
        metadata,
        created_at,
        advances!advance_id (
          id,
          amount,
          net_amount,
          currency,
          disbursement_method,
          requested_at
        ),
        employees!employee_id (
          id,
          full_name,
          email,
          employee_code,
          kyc_status,
          risk_score,
          country
        ),
        employers!employer_id (
          id,
          company_name,
          company_code,
          disbursements_frozen
        )
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (severityFilter) query = query.eq('severity', severityFilter);

    const { data: rows, error: queryError } = await query;
    if (queryError) throw queryError;

    const { count: totalOpen } = await adminSupabase
      .from('fraud_flags')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');

    const { count: totalCritical } = await adminSupabase
      .from('fraud_flags')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .eq('severity', 'critical');

    const cases: FraudCase[] = (rows ?? []).map((row) => {
      const advance = Array.isArray(row.advances) ? row.advances[0] : row.advances;
      const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
      const employer = Array.isArray(row.employers) ? row.employers[0] : row.employers;

      return {
        flagId: row.id as string,
        flagType: isFraudFlagType(row.flag_type) ? row.flag_type : 'manual_report',
        severity: isFraudSeverity(row.severity) ? row.severity : 'medium',
        description: typeof row.description === 'string' ? row.description : '',
        triggeredBy: typeof row.triggered_by === 'string' ? row.triggered_by : 'system',
        flagStatus: isFraudFlagStatus(row.status) ? row.status : 'open',
        reviewedAt: typeof row.reviewed_at === 'string' ? row.reviewed_at : null,
        reviewNotes: typeof row.review_notes === 'string' ? row.review_notes : null,
        metadata: parseMetadata(row.metadata),
        flagCreatedAt: row.created_at as string,
        advanceId: advance?.id ?? '',
        advanceAmount: Number(advance?.amount ?? 0),
        advanceNetAmount: Number(advance?.net_amount ?? 0),
        advanceCurrency: typeof advance?.currency === 'string' ? advance.currency : 'KES',
        disbursementMethod: typeof advance?.disbursement_method === 'string' ? advance.disbursement_method : '',
        requestedAt: typeof advance?.requested_at === 'string' ? advance.requested_at : '',
        employeeId: employee?.id ?? '',
        employeeName: typeof employee?.full_name === 'string' ? employee.full_name : '',
        employeeEmail: typeof employee?.email === 'string' ? employee.email : '',
        employeeCode: typeof employee?.employee_code === 'string' ? employee.employee_code : '',
        kycStatus: typeof employee?.kyc_status === 'string' ? employee.kyc_status : '',
        riskScore: employee?.risk_score != null ? Number(employee.risk_score) : null,
        country: typeof employee?.country === 'string' ? employee.country : '',
        employerId: employer?.id ?? '',
        companyName: typeof employer?.company_name === 'string' ? employer.company_name : '',
        companyCode: typeof employer?.company_code === 'string' ? employer.company_code : '',
        employerFrozen: employer?.disbursements_frozen === true,
      };
    });

    const response: FraudFlagsResponse = {
      cases,
      totalOpen: totalOpen ?? 0,
      totalCritical: totalCritical ?? 0,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Fraud Flags GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}