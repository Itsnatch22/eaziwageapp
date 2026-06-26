import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { getStanbicAuthHeader, getStanbicBaseUrl } from '@/lib/stanbic/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StanbicBalanceResponse {
  availableBalance?: string[] | string | number;
  currency?: string;
  balance?: string | number;
  accountNumber?: string;
  account_number?: string;
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
    typeof p.availableBalance !== 'undefined' ||
    typeof p.balance !== 'undefined'
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeBalance(raw: unknown): number | null {
  if (Array.isArray(raw) && raw.length > 0) {
    raw = raw[0];
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;

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
        console.warn('[Admin Wallet GET] Failed to fetch transactions:', txError.message);
      } else if (txs) {
        transactions = txs;
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

    const url = getStanbicBaseUrl();
    console.log(`[Stanbic API] Calling balance endpoint: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

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
      return NextResponse.json({ error: `Failed to reach Stanbic API: ${m}` }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    if (!stanbicRes.ok) {
      const body = await stanbicRes.text().catch(() => '');
      console.error(`[Stanbic API] HTTP ${stanbicRes.status}:`, body.slice(0, 300));
      return NextResponse.json({ error: `Stanbic API returned ${stanbicRes.status}` }, { status: 502 });
    }

    const parsed = await stanbicRes.json().catch(() => null);
    if (!isRecord(parsed)) {
      return NextResponse.json({ error: 'Invalid JSON from Stanbic' }, { status: 502 });
    }

    console.log('[Stanbic API] Raw response:', JSON.stringify(parsed));

    if (!isStanbicResponse(parsed)) {
      console.error('[Stanbic API] Unexpected payload shape:', parsed);
      return NextResponse.json({ error: 'Unexpected Stanbic response shape' }, { status: 502 });
    }

    // Extract balance
    const rawBalance = parsed.availableBalance ?? parsed.balance;
    const normalizedBalance = normalizeBalance(rawBalance);

    if (normalizedBalance === null) {
      return NextResponse.json({ 
        error: 'Stanbic returned invalid balance', 
        raw: parsed 
      }, { status: 502 });
    }

    // Determine currency (prefer response, fallback to existing wallet, then USD)
    let currency = parsed.currency;
    if (!currency) {
      // We'll get it from the existing wallet record below
      currency = 'USD';
    }

    // Fetch existing wallet
    const { data: existingWallet, error: existingError } = await adminSupabase
      .from('admin_wallets')
      .select('id, name, balance, currency')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<Pick<AdminWallet, 'id' | 'name' | 'balance' | 'currency'>>();

    if (existingError) throw existingError;
    if (!existingWallet) {
      return NextResponse.json({ error: 'Admin wallet record not found' }, { status: 500 });
    }

    // Use wallet's currency if Stanbic doesn't return one
    const finalCurrency = currency || existingWallet.currency || 'USD';

    // Suspicious drop protection
    if (isSuspiciousDrop(existingWallet.balance, normalizedBalance)) {
      console.error(`[Stanbic Sync] Suspicious drop: ${existingWallet.balance} → ${normalizedBalance}`);
      return NextResponse.json(
        {
          error: 'Suspicious balance drop detected. Manual review required.',
          previous: existingWallet.balance,
          incoming: normalizedBalance,
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();

    // Update wallet
    const { error: updateError } = await adminSupabase
      .from('admin_wallets')
      .update({
        balance: normalizedBalance,
        currency: finalCurrency,
        last_reconciled_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', existingWallet.id);

    if (updateError) throw updateError;

    // Record transaction
    const syncRef = `SYNC-${Date.now()}-${existingWallet.id.slice(0, 8).toUpperCase()}`;
    const txPayload = {
      admin_wallet_id: existingWallet.id,
      amount: normalizedBalance,
      type: 'adjustment',
      status: 'completed',
      reference: syncRef,
      description: 'Stanbic balance sync',
      metadata: {
        raw_response: parsed,
        currency: finalCurrency,
      },
    };

    const { error: txInsertError } = await adminSupabase
      .from('admin_wallet_transactions')
      .insert(txPayload);

    if (txInsertError) throw txInsertError;

    return NextResponse.json({
      success: true,
      wallet: {
        id: existingWallet.id,
        balance: normalizedBalance,
        currency: finalCurrency,
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