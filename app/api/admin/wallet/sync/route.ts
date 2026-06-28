import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { getStanbicAuthHeader, getStanbicBalanceUrl } from '@/lib/stanbic/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StanbicBalanceResponse {
  availableBalance?: string[] | string | number;  // Actual format from Stanbic
  currency?: string;
  balance?: string | number;                      // Fallback
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeBalance(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;

  // Stanbic returns availableBalance as the string "[100000.00]" — a stringified
  // single-element array. Strip the brackets before parsing.
  if (typeof raw === 'string') {
    const stripped = raw.trim().replace(/^\[|\]$/g, '').trim();
    const n = parseFloat(stripped);
    const rounded = Number(n.toFixed(2));
    return Number.isFinite(rounded) && rounded >= 0 ? rounded : null;
  }

  if (typeof raw === 'number') {
    const rounded = Number(raw.toFixed(2));
    return Number.isFinite(rounded) && rounded >= 0 ? rounded : null;
  }

  // Actual array (rawBalanceResponse schema): take first element's availableBalance
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    return normalizeBalance(
      isRecord(first)
        ? (first.availableBalance ?? first.bookedBalance ?? first.balance)
        : first
    );
  }

  // Nested object fallback
  if (isRecord(raw)) {
    return normalizeBalance(
      raw.availableBalance ?? raw.balance ?? raw.available ?? raw.amount
    );
  }

  return null;
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

    // ─── Authentication ─────────────────────────────────────
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

    let url: string;
    try {
      url = getStanbicBalanceUrl();
    } catch (urlErr) {
      const m = urlErr instanceof Error ? urlErr.message : String(urlErr);
      return NextResponse.json({ error: m }, { status: 500 });
    }
    console.log(`[Stanbic API] Calling balance endpoint (GET): ${url}`);

    // ─── Fetch from Stanbic ─────────────────────────────────────
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

    let stanbicRes: Response;
    try {
      stanbicRes = await fetch(url, {
        method: 'GET', // Confirmed by your schema
        headers: { 
          ...authHeader, 
          Accept: 'application/json' 
        },
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
      console.error(`[Stanbic API] HTTP ${stanbicRes.status}:`, body.slice(0, 500));
      return NextResponse.json(
        { error: `Stanbic API returned ${stanbicRes.status}`, raw: body },
        { status: 502 }
      );
    }

    // ─── Parse Response ────────────────────────────────────────
    let parsed: any = {};
    try {
      const rawText = await stanbicRes.text();
      console.log('[Stanbic API] Raw response text:', rawText);

      if (rawText.trim()) {
        parsed = JSON.parse(rawText);
      } else {
        // Empty body with 200 usually means the subscription key header was missing
        // or the account number is not in the URL. Log response headers to diagnose.
        const headerDump: Record<string, string> = {};
        stanbicRes.headers.forEach((v, k) => { headerDump[k] = v; });
        console.warn('[Stanbic API] Empty body — response headers:', JSON.stringify(headerDump));
      }
    } catch (parseErr) {
      console.error('[Stanbic API] JSON parse error');
    }

    console.log('[Stanbic API] Parsed response:', JSON.stringify(parsed, null, 2));

    if (!isRecord(parsed)) {
      return NextResponse.json({ 
        error: 'Invalid response format from Stanbic', 
        raw: parsed 
      }, { status: 502 });
    }

    // Extract balance (handles array ["123.45"], string, number, etc.)
    let rawBalance: unknown = parsed.availableBalance ?? parsed.balance;
    const normalizedBalance = normalizeBalance(rawBalance);

    if (normalizedBalance === null) {
      return NextResponse.json({
        error: 'Stanbic returned a response with no balance data',
        raw: parsed,
        note: Object.keys(parsed).length === 0
          ? 'Empty response {} — the sandbox account may have no balance configured. Log into the Stanbic developer portal and verify the account linked to your API key has a test balance set.'
          : 'Response received but availableBalance field is missing or zero.',
      }, { status: 502 });
    }

    // ─── Update Database ───────────────────────────────────────
    const { data: existingWallet, error: existingError } = await adminSupabase
      .from('admin_wallets')
      .select('id, name, balance, currency')
      .eq('name', 'Main Stanbic Source')
      .maybeSingle<Pick<AdminWallet, 'id' | 'name' | 'balance' | 'currency'>>();

    if (existingError) throw existingError;
    if (!existingWallet) {
      return NextResponse.json({ error: 'Admin wallet record not found' }, { status: 500 });
    }

    const finalCurrency = parsed.currency || existingWallet.currency || 'USD';

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

    // Update wallet balance
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

    // Record sync transaction
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
        source: 'stanbic_balance_api',
      },
    };

    const { error: txInsertError } = await adminSupabase
      .from('admin_wallet_transactions')
      .insert(txPayload);

    if (txInsertError) throw txInsertError;

    console.log(`[Stanbic Sync] Success - New balance: ${normalizedBalance} ${finalCurrency}`);

    return NextResponse.json({
      success: true,
      wallet: {
        id: existingWallet.id,
        balance: normalizedBalance,
        currency: finalCurrency,
        last_reconciled_at: nowIso,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin Wallet POST] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}