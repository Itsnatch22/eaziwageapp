import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

type RiskRating = 'low' | 'medium' | 'high' | 'critical';
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

export async function GET(): Promise<NextResponse<TopUpRequestsResponse | { error: string }>> {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
    if (adminAccess.error || !adminAccess.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch pending top-up requests with employer data
    const { data: rows, error } = await supabaseAdmin
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
          id,
          employer_id,
          balance,
          currency
        ),
        employer_wallets!wallet_id (
          employers!employer_id (
            id,
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

    if (error) throw error;

    // Enrich rows with employer data
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
      employer_wallets?: Array<{
        employer_id: string;
        balance: number;
        currency: string;
        employers?: Array<{
          company_name: string;
          company_code: string;
          country: string;
          contact_person: string | null;
          risk_score: number | null;
          risk_rating: RiskRating | null;
        }>;
      }>;
    }

    const enrichedRequests: TopUpRequest[] = (rows ?? []).map((row: EnrichedRow) => ({
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
      employer_id: row.employer_wallets?.[0]?.employer_id ?? '',
      company_name: row.employer_wallets?.[0]?.employers?.[0]?.company_name ?? 'Unknown',
      company_code: row.employer_wallets?.[0]?.employers?.[0]?.company_code ?? '',
      country: row.employer_wallets?.[0]?.employers?.[0]?.country ?? '',
      contact_person: row.employer_wallets?.[0]?.employers?.[0]?.contact_person ?? null,
      risk_score: row.employer_wallets?.[0]?.employers?.[0]?.risk_score ?? null,
      risk_rating: row.employer_wallets?.[0]?.employers?.[0]?.risk_rating ?? null,
      current_wallet_balance: row.employer_wallets?.[0]?.balance ?? 0,
      wallet_currency: row.employer_wallets?.[0]?.currency ?? 'KES',
    }));

    // Fetch admin wallet
    const { data: adminWalletRow, error: walletError } = await supabaseAdmin
      .from('admin_wallets')
      .select('id, name, balance, currency, last_reconciled_at')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<AdminWallet>();

    if (walletError) throw walletError;

    return NextResponse.json({
      requests: enrichedRequests,
      adminWallet: adminWalletRow ?? { id: '', name: 'Main Stanbic Source', balance: 0, currency: 'USD', last_reconciled_at: null },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin TopUp Requests GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
