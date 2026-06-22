import React, { Suspense } from 'react';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import TopUpRequestsClient from './TopUpRequestsClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type RiskRating = 'low' | 'medium' | 'high' | 'critical';
type LocalCurrency = 'KES' | 'UGX' | 'TZS' | 'RWF';
type TopUpStatus = 'pending' | 'completed' | 'failed';

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
  status: TopUpStatus;
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

async function fetchTopUpData() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Not authenticated');
    }

    const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
    if (adminAccess.error || !adminAccess.isAdmin) {
      throw new Error('Not authorized');
    }

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
      id: row.id as string,
      wallet_id: row.wallet_id as string,
      amount: row.amount as number,
      usd_amount: row.usd_amount as number | null,
      rate_snapshot: row.rate_snapshot as number | null,
      local_currency: row.local_currency as LocalCurrency | null,
      status: row.status as TopUpStatus,
      reference: row.reference as string | null,
      description: row.description as string | null,
      metadata: row.metadata as TopUpRequestMetadata,
      created_at: row.created_at as string,
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

    const { data: adminWalletRow, error: walletError } = await supabaseAdmin
      .from('admin_wallets')
      .select('id, name, balance, currency, last_reconciled_at')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<AdminWallet>();

    if (walletError) throw walletError;

    return {
      requests: enrichedRequests,
      adminWallet: adminWalletRow ?? {
        id: '',
        name: 'Main Stanbic Source',
        balance: 0,
        currency: 'USD' as const,
        last_reconciled_at: null,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load data';
    throw new Error(message);
  }
}

function TopUpRequestsLoading() {
  return (
    <div className="space-y-8">
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-3" />
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-6" />
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-40" />
      </div>

      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="h-16 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function TopUpRequestsError({ error }: { error: Error }) {
  return (
    <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
      <AlertDescription className="text-red-800 dark:text-red-300">
        {error.message}
      </AlertDescription>
    </Alert>
  );
}

export default function TopUpRequestsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Wallet Top-Up Requests</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Review and approve employer wallet top-up requests.
        </p>
      </div>

      <Suspense fallback={<TopUpRequestsLoading />}>
        <TopUpRequestsContent />
      </Suspense>
    </div>
  );
}

async function TopUpRequestsContent() {
  let data;
  let error;

  try {
    data = await fetchTopUpData();
  } catch (err: unknown) {
    error = err instanceof Error ? err : new Error('Unknown error');
  }

  if (error) {
    return <TopUpRequestsError error={error} />;
  }

  if (!data) {
    return <TopUpRequestsError error={new Error('No data available')} />;
  }

  return (
    <TopUpRequestsClient
      initialRequests={data.requests}
      initialAdminWallet={data.adminWallet}
    />
  );
}
