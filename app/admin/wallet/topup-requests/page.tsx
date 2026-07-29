import React, { Suspense } from 'react';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import TopUpRequestsClient from './TopUpRequestsClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type RiskRating = 'A' | 'B' | 'C' | 'D';
type LocalCurrency = 'KES' | 'UGX' | 'TZS' | 'RWF';
type TopUpStatus = 'pending' | 'completed' | 'failed' | 'rejected';

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
          employer_id,
          total_advanced,
          outstanding_liability,
          total_repaid,
          reserved_amount,
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
      console.error('[TopUp] Supabase query error:', JSON.stringify(error));
      throw error;
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
        reserved_amount: number;
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
        status: row.status as TopUpStatus,
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
        // Spendable balance, matching reserve_employer_funds()'s own availability
        // check — not total_advanced - total_repaid - outstanding_liability,
        // which double-subtracts the liability (outstanding_liability already
        // tracks the same money as total_advanced - total_repaid; the deduction
        // that actually applies here is reserved_amount, held against in-flight
        // advances).
        current_wallet_balance: Math.max(
          0,
          (wallet?.total_advanced ?? 0) - (wallet?.total_repaid ?? 0) - (wallet?.reserved_amount ?? 0),
        ),
        wallet_currency: wallet?.currency ?? 'KES',
      };
    });

    return { requests: enrichedRequests };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load data';
    throw new Error(message);
  }
}

function TopUpRequestsLoading() {
  return (
    <div className="space-y-8">
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
    />
  );
}