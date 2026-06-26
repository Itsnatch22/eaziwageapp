import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { getStanbicAuthHeader, getStanbicBaseUrl } from '@/lib/stanbic/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StanbicBalanceResponse {
  currency: string;
  balance: string | number;
  accountNumber?: string;
  account_number?: string;
  timestamp?: string;
  updated_at?: string;
}

interface AdminWallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  last_reconciled_at: string | null;
  updated_at: string;
}

// ─── Guards ───────────────────────────────────────────────────────────────────

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null;
}

function isStanbicResponse(payload: unknown): payload is StanbicBalanceResponse {
  if (!isRecord(payload)) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.currency === 'string' &&
    (typeof p.balance === 'string' || typeof p.balance === 'number') &&
    (typeof p.accountNumber === 'string' || typeof p.account_number === 'string') &&
    (typeof p.timestamp === 'string' || typeof p.updated_at === 'string')
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeBalance(raw: string | number): number | null {
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  const rounded = Number(n.toFixed(2));
  return Number.isFinite(rounded) && rounded >= 0 ? rounded : null;
}

function isSuspiciousDrop(previous: number, incoming: number): boolean {
  if (previous <= 100) return false;
  const drop = ((previous - incoming) / previous) * 100;
  return drop > 50;
}

// ─── GET — read wallet + last 5 transactions ──────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { data: wallet, error: walletError } = await adminSupabase
      .from('admin_wallets')
      .select('id, name, balance, currency, last_reconciled_at, updated_at')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<AdminWallet>();

    if (walletError) throw walletError;

    let transactions: Array<Record<string, unknown>> = [];

    if (wallet?.id) {
      const { data: txs, error: txError } = await adminSupabase
        .from('admin_wallet_transactions')
        .select('id, admin_wallet_id, amount, type, status, reference, description, metadata, created_at')
        .eq('admin_wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (txError) {
        // Non-fatal — wallet exists, transactions are supplementary
        console.warn('[Admin Wallet GET] Failed to fetch transactions:', txError.message);
      } else if (txs) {
        transactions = txs as Array<Record<string, unknown>>;
      }
    }

    return NextResponse.json({ wallet: wallet ?? null, transactions });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin Wallet GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST — sync balance from Stanbic ─────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    // Step 1: Obtain auth header — isolated so token errors surface clearly
    let authHeader: Record<string, string>;
    try {
      authHeader = await getStanbicAuthHeader();
    } catch (tokenErr) {
      const m = tokenErr instanceof Error ? tokenErr.message : 'Token error';
      console.error('[Stanbic Client] Token retrieval failed:', m);
      return NextResponse.json(
        { error: `Stanbic authentication failed: ${m}` },
        { status: 502 }
      );
    }

    // Step 2: Call Stanbic balance endpoint with a timeout
    const url = `${getStanbicBaseUrl()}/accounts/balance`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s hard cap

    let stanbicRes: Response;
    try {
      stanbicRes = await fetch(url, {
        method: 'GET',
        headers: { ...authHeader, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (fetchErr) {
      const m = fetchErr instanceof Error ? fetchErr.message : 'Network error';
      console.error('[Stanbic API] Fetch failed:', m);
      return NextResponse.json(
        { error: `Failed to reach Stanbic API: ${m}` },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    // Step 3: Surface non-2xx HTTP errors before trying to parse JSON
    if (!stanbicRes.ok) {
      const body = await stanbicRes.text().catch(() => '');
      console.error(`[Stanbic API] HTTP ${stanbicRes.status}:`, body.slice(0, 300));
      return NextResponse.json(
        { error: `Stanbic API returned ${stanbicRes.status}` },
        { status: 502 }
      );
    }

    // Step 4: Parse + validate payload shape
    const parsed = await stanbicRes.json().catch(() => null);

    if (!isRecord(parsed)) {
      console.error('[Stanbic API] Response is not a JSON object');
      return NextResponse.json({ error: 'Invalid response from Stanbic' }, { status: 502 });
    }

    if (!isStanbicResponse(parsed)) {
      console.error('[Stanbic API] Unexpected payload shape:', parsed);
      return NextResponse.json({ error: 'Unexpected Stanbic response shape' }, { status: 502 });
    }

    // Step 5: Normalize balance
    const normalizedBalance = normalizeBalance(parsed.balance);
    if (normalizedBalance === null) {
      return NextResponse.json({ error: 'Stanbic returned invalid balance' }, { status: 502 });
    }

    // Step 6: Fetch existing wallet record
    const { data: existingWallet, error: existingError } = await adminSupabase
      .from('admin_wallets')
      .select('id, name, balance, currency')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<Pick<AdminWallet, 'id' | 'name' | 'balance' | 'currency'>>();

    if (existingError) throw existingError;
    if (!existingWallet) {
      return NextResponse.json({ error: 'Admin wallet record not found' }, { status: 500 });
    }

    // Step 7: Sanity-check for suspicious drops
    if (isSuspiciousDrop(existingWallet.balance, normalizedBalance)) {
      console.error(
        `[Stanbic Sync] Balance drop >50%: ${existingWallet.balance} → ${normalizedBalance}`
      );
      return NextResponse.json(
        {
          error: 'Suspicious balance drop detected. Manual reconciliation required.',
          previous: existingWallet.balance,
          incoming: normalizedBalance,
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();

    // Step 8: Update wallet
    const { error: updateError } = await adminSupabase
      .from('admin_wallets')
      .update({
        balance: normalizedBalance,
        currency: parsed.currency,          // trust what Stanbic says
        last_reconciled_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', existingWallet.id);

    if (updateError) throw updateError;

    // Step 9: Record transaction
    const accountNumber =
      (parsed as Record<string, unknown>).accountNumber ??
      (parsed as Record<string, unknown>).account_number ??
      null;

    const txPayload = {
      admin_wallet_id: existingWallet.id,
      amount: normalizedBalance,
      type: 'adjustment',
      status: 'completed',
      reference: null,
      description: 'Stanbic balance sync',
      metadata: {
        raw_response: parsed as Record<string, unknown>,
        account_number: accountNumber,
      },
    };

    const { error: txInsertError } = await adminSupabase
      .from('admin_wallet_transactions')
      .insert(txPayload);

    if (txInsertError) throw txInsertError;

    return NextResponse.json({
      wallet: {
        id: existingWallet.id,
        balance: normalizedBalance,
        currency: parsed.currency,
        last_reconciled_at: nowIso,
      },
      transaction: txPayload,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin Wallet POST] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}