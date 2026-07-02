import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

type RiskRating = 'A' | 'B' | 'C' | 'D';
type LocalCurrency = 'KES' | 'UGX' | 'TZS' | 'RWF';

interface TopUpRequestMetadata {
  employer_id: string;
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface TopUpRequest {
  id: string;
  wallet_id: string;
  amount: number;
  usd_amount: number | null;
  rate_snapshot: number | null;
  local_currency: LocalCurrency | null;
  status: string;
  reference: string | null;
  description: string | null;
  metadata: TopUpRequestMetadata;
  created_at: string;
  employer_id: string;
  company_name: string;
  company_code: string;
  country: string;
  contact_person: string | null;
  risk_score: number | null;
  risk_rating: RiskRating | null;
  current_wallet_balance: number;
  wallet_currency: string;
}

interface AdminWallet {
  id: string;
  name: string;
  balance: number;
  currency: 'USD';
  last_reconciled_at: string | null;
}

interface TopUpRequestsResponse {
  requests: TopUpRequest[];
  adminWallet: AdminWallet;
}

interface EnrichedRow {
  id: string;
  wallet_id: string;
  amount: number;
  usd_amount: number | null;
  rate_snapshot: number | null;
  local_currency: LocalCurrency | null;
  status: string;
  reference: string | null;
  description: string | null;
  metadata: TopUpRequestMetadata;
  created_at: string;
  employer_wallets?: {
    employer_id: string;
    total_advanced: number;
    outstanding_liability: number;
    total_repaid: number;
    currency: string;
    employers?: {
      company_name: string;
      company_code: string;
      country: string;
      contact_person: string | null;
      risk_score: number | null;
      risk_rating: RiskRating | null;
    } | null;
  } | null;
}

export async function GET(req: NextRequest): Promise<NextResponse<TopUpRequestsResponse | { error: string }>> {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    // Single collapsed relation — wallet_transactions → employer_wallets → employers
    const { data: rows, error } = await adminSupabase
      .from('wallet_transactions')
      .select(`
        id,
        wallet_id,
        amount,
        usd_amount,
        rate_snapshot,
        local_currency,
        status,
        reference,
        description,
        metadata,
        created_at,
        employer_wallets!wallet_id (
          employer_id,
          total_advanced,
          outstanding_liability,
          total_repaid,
          currency,
          employers!employer_id (
            company_name,
            company_code,
            country,
            contact_person,
            risk_score,
            risk_rating
          )
        )
      `)
      .eq('type', 'deposit')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return dbErrorResponse('admin/wallet/topup-requests GET', error);
    }

    const enrichedRequests: TopUpRequest[] = ((rows ?? []) as unknown as EnrichedRow[]).map((row) => {
      const wallet = row.employer_wallets;
      const employer = wallet?.employers;

      return {
        id: row.id,
        wallet_id: row.wallet_id,
        amount: row.amount,
        usd_amount: row.usd_amount,
        rate_snapshot: row.rate_snapshot,
        local_currency: row.local_currency,
        status: row.status,
        reference: row.reference,
        description: row.description,
        metadata: row.metadata,
        created_at: row.created_at,
        employer_id: wallet?.employer_id ?? '',
        company_name: employer?.company_name ?? 'Unknown',
        company_code: employer?.company_code ?? '',
        country: employer?.country ?? '',
        contact_person: employer?.contact_person ?? null,
        risk_score: employer?.risk_score ?? null,
        risk_rating: employer?.risk_rating ?? null,
        current_wallet_balance: (wallet?.total_advanced ?? 0) - (wallet?.total_repaid ?? 0) - (wallet?.outstanding_liability ?? 0),
        wallet_currency: wallet?.currency ?? 'KES',
      };
    });

    const { data: adminWalletRow, error: walletError } = await adminSupabase
      .from('admin_wallets')
      .select('id, name, balance, currency, last_reconciled_at')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<AdminWallet>();

    if (walletError) throw walletError;

    return NextResponse.json({
      requests: enrichedRequests,
      adminWallet: adminWalletRow ?? {
        id: '',
        name: 'Main Stanbic Source',
        balance: 0,
        currency: 'USD',
        last_reconciled_at: null,
      },
    });
  } catch (err: unknown) {
    return dbErrorResponse('admin/wallet/topup-requests GET', err);
  }
}