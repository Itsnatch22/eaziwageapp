import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { getStanbicAuthHeader, getStanbicBalanceUrl } from '@/lib/stanbic/client';
import { requestLogger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  const log = requestLogger('admin-wallet-sync-get', req);
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
        log.warn('Failed to fetch transactions', { err: txError.message });
      } else if (txs) {
        transactions = txs;
      }
    }

    return NextResponse.json({ wallet: wallet ?? null, transactions });
  } catch (err: unknown) {
    log.error('Unhandled error', { err });
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST — sync balance from Stanbic ─────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const log = requestLogger('admin-wallet-sync-post', req);
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
      log.error('Stanbic token retrieval failed', { err: m });
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
    log.info('Calling Stanbic balance endpoint');

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
      log.error('Stanbic API fetch failed', { err: m });
      return NextResponse.json({ error: `Failed to reach Stanbic API: ${m}` }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    if (!stanbicRes.ok) {
      const body = await stanbicRes.text().catch(() => '');
      log.error('Stanbic API returned non-2xx', { status: stanbicRes.status });
      return NextResponse.json(
        { error: `Stanbic API returned ${stanbicRes.status}`, raw: body },
        { status: 502 }
      );
    }

    // ─── Parse Response ────────────────────────────────────────
    let parsed: Record<string, unknown> = {};
    try {
      const rawText = await stanbicRes.text();

      if (rawText.trim()) {
        parsed = JSON.parse(rawText);
        log.info('Stanbic response parsed', { keys: Object.keys(parsed) });
      } else {
        // Empty body with 200 usually means the subscription key header was missing
        // or the account number is not in the URL. Log response headers to diagnose.
        const headerDump: Record<string, string> = {};
        stanbicRes.headers.forEach((v, k) => { headerDump[k] = v; });
        log.warn('Stanbic returned empty body', { responseHeaders: headerDump });
      }
    } catch {
      log.error('Stanbic response JSON parse failed');
    }

    if (!isRecord(parsed)) {
      return NextResponse.json({ 
        error: 'Invalid response format from Stanbic', 
        raw: parsed 
      }, { status: 502 });
    }

    // Extract balance (handles array ["123.45"], string, number, etc.)
    const rawBalance: unknown = parsed.availableBalance ?? parsed.balance;
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
      log.error('Suspicious balance drop detected — manual review required', { previous: existingWallet.balance, incoming: normalizedBalance });
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

    log.info('Stanbic sync complete', { balance: normalizedBalance, currency: finalCurrency });

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
    log.error('Unhandled error', { err });
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}