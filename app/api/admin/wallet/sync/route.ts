import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { getStanbicAuthHeader, getStanbicBaseUrl } from '@/lib/stanbic/client';

interface StanbicBalanceResponse {
  currency: string;
  balance: string | number;
  accountNumber: string;
  timestamp: string;
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null;
}

function isStanbicResponse(payload: unknown): payload is StanbicBalanceResponse {
  if (!isRecord(payload)) return false;
  return (
    typeof payload.currency === 'string' &&
    (typeof payload.balance === 'string' || typeof payload.balance === 'number') &&
    (typeof (payload as Record<string, unknown>).accountNumber === 'string' || typeof (payload as Record<string, unknown>).account_number === 'string') &&
    (typeof (payload as Record<string, unknown>).timestamp === 'string' || typeof (payload as Record<string, unknown>).updated_at === 'string')
  );
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
    if (adminAccess.error || !adminAccess.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('admin_wallets')
      .select('id, name, balance, currency, last_reconciled_at, updated_at')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<{ id: string; name: string; balance: number; currency: string; last_reconciled_at: string | null; updated_at: string }>();

    if (walletError) throw walletError;

    let transactions: Array<Record<string, unknown>> = [];
    if (wallet?.id) {
      const { data: txs, error: txError } = await supabaseAdmin
        .from('admin_wallet_transactions')
        .select('id, admin_wallet_id, amount, type, status, reference, description, metadata, created_at')
        .eq('admin_wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!txError && txs) transactions = txs as Array<Record<string, unknown>>;
    }

    return NextResponse.json({ wallet: wallet ?? null, transactions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin Wallet GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
    if (adminAccess.error || !adminAccess.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stanbicBase = getStanbicBaseUrl();

    const url = `${stanbicBase}/accounts/balance`;

    let response: Response;
    try {
      const authHeader = await getStanbicAuthHeader();
      const headers = {
        ...authHeader,
        'Accept': 'application/json',
      } as Record<string, string>;

      response = await fetch(url, {
        method: 'GET',
        headers,
      });
    } catch (fetchErr) {
      const m = fetchErr instanceof Error ? fetchErr.message : 'Network error';
      console.error('[Stanbic API] Fetch error:', m);
      return NextResponse.json({ error: `Failed to call Stanbic API: ${m}` }, { status: 502 });
    }

    const parsed = await response.json().catch(() => null);
    if (!isRecord(parsed)) {
      return NextResponse.json({ error: 'Invalid response from Stanbic' }, { status: 502 });
    }

    if (!isStanbicResponse(parsed)) {
      console.error('[Stanbic API] Unexpected payload shape:', parsed);
      return NextResponse.json({ error: 'Unexpected Stanbic response shape' }, { status: 502 });
    }

    const stanbicData = parsed as StanbicBalanceResponse;

    const balanceNumber = typeof stanbicData.balance === 'string' 
      ? parseFloat(stanbicData.balance) 
      : Number(stanbicData.balance);
    const normalizedBalance = Number(balanceNumber.toFixed(2));

    if (!Number.isFinite(normalizedBalance) || normalizedBalance < 0) {
      return NextResponse.json({ error: 'Stanbic returned invalid balance' }, { status: 502 });
    }

    const { data: existingWallet, error: existingError } = await supabaseAdmin
      .from('admin_wallets')
      .select('id, name, balance, currency')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<{ id: string; name: string; balance: number; currency: string }>();

    if (existingError) throw existingError;
    if (!existingWallet) {
      return NextResponse.json({ error: 'Admin wallet record not found' }, { status: 500 });
    }

    const dropPercent = existingWallet.balance > 0 
      ? ((existingWallet.balance - normalizedBalance) / existingWallet.balance) * 100 
      : 0;

    if (dropPercent > 50 && existingWallet.balance > 100) {
      console.error(`[Stanbic Sync] Balance drop >50% detected: ${existingWallet.balance} -> ${normalizedBalance}`);
      return NextResponse.json({ 
        error: 'Suspicious balance drop detected. Manual reconciliation required.',
        previous: existingWallet.balance,
        incoming: normalizedBalance
      }, { status: 409 });
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('admin_wallets')
      .update({ 
        balance: normalizedBalance, 
        currency: 'USD',
        last_reconciled_at: nowIso, 
        updated_at: nowIso 
      })
      .eq('id', existingWallet.id);

    if (updateError) throw updateError;

     const txPayload = {
      admin_wallet_id: existingWallet.id,
      amount: normalizedBalance,
      type: 'adjustment',
      status: 'completed',
      reference: null,
      description: 'Stanbic balance sync',
      metadata: { raw_response: parsed as Record<string, unknown>, account_number: (parsed as Record<string, unknown>).accountNumber ?? (parsed as Record<string, unknown>).account_number },
    } as Record<string, unknown>;

    const { error: txInsertError } = await supabaseAdmin
      .from('admin_wallet_transactions')
      .insert(txPayload);

    if (txInsertError) throw txInsertError;

    return NextResponse.json({ wallet: { id: existingWallet.id, balance: normalizedBalance, currency: stanbicData.currency, last_reconciled_at: nowIso }, transaction: txPayload });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin Wallet POST] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
