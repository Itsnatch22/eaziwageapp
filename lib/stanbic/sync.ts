import type { SupabaseClient } from '@supabase/supabase-js';
import { getStanbicAuthHeader, getStanbicBalanceUrl } from './client';
import type { Logger } from '../logger';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminWallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  last_reconciled_at: string | null;
  updated_at: string;
}

export type StanbicSyncResult =
  | {
      ok: true;
      wallet: { id: string; balance: number; currency: string; last_reconciled_at: string };
      currencyAnomaly: boolean;
    }
  | { ok: false; status: number; error: string; details?: unknown };

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

// ─── Shared sync — called by both the admin-session route and the cron route ──
// Nothing about the actual Stanbic fetch/parse/normalize/suspicious-drop logic
// below has changed from its original form in app/api/admin/wallet/sync/route.ts
// — only relocated so both callers can share it. The one behavior change is the
// currency-drift guard: admin_wallets.currency is always USD by platform
// convention, so a Stanbic response carrying any other currency value is now
// treated as a sync anomaly (logged, flagged, balance still updated) instead of
// being silently written over the existing value.
export async function syncStanbicBalance(
  adminSupabase: SupabaseClient,
  log: Logger,
): Promise<StanbicSyncResult> {
  // ─── Authentication ─────────────────────────────────────
  let authHeader: Record<string, string>;
  try {
    authHeader = await getStanbicAuthHeader();
  } catch (tokenErr) {
    const m = tokenErr instanceof Error ? tokenErr.message : 'Token error';
    log.error('Stanbic token retrieval failed', { err: m });
    return { ok: false, status: 502, error: `Stanbic authentication failed: ${m}` };
  }

  let url: string;
  try {
    url = getStanbicBalanceUrl();
  } catch (urlErr) {
    const m = urlErr instanceof Error ? urlErr.message : String(urlErr);
    return { ok: false, status: 500, error: m };
  }
  log.info('Calling Stanbic balance endpoint');

  // ─── Fetch from Stanbic ─────────────────────────────────────
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  let stanbicRes: Response;
  try {
    stanbicRes = await fetch(url, {
      method: 'GET', // Confirmed by the schema
      headers: {
        ...authHeader,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (fetchErr) {
    const m = fetchErr instanceof Error ? fetchErr.message : 'Network error';
    log.error('Stanbic API fetch failed', { err: m });
    return { ok: false, status: 502, error: `Failed to reach Stanbic API: ${m}` };
  } finally {
    clearTimeout(timeout);
  }

  if (!stanbicRes.ok) {
    const body = await stanbicRes.text().catch(() => '');
    log.error('Stanbic API returned non-2xx', { status: stanbicRes.status });
    return { ok: false, status: 502, error: `Stanbic API returned ${stanbicRes.status}`, details: body };
  }

  // ─── Parse Response ────────────────────────────────────────
  let parsed: Record<string, unknown> = {};
  try {
    const rawText = await stanbicRes.text();

    if (rawText.trim()) {
      parsed = JSON.parse(rawText);
      log.info('Stanbic response parsed', { keys: Object.keys(parsed) });
      // A 200 that parses to an empty {} / [] is the confusing case: auth and
      // transport succeeded but Stanbic returned no balance. Dump the response
      // headers + raw body so the next occurrence shows whether it's an Azure
      // APIM subscription problem (diagnostic header) or an unconfigured
      // sandbox balance — the empty-*body* branch below already does this, but
      // an empty-*object* never reached it.
      if (isRecord(parsed) && Object.keys(parsed).length === 0) {
        const headerDump: Record<string, string> = {};
        stanbicRes.headers.forEach((v, k) => { headerDump[k] = v; });
        log.warn('Stanbic returned an empty object — no balance data', {
          responseHeaders: headerDump,
          rawBody: rawText.slice(0, 500),
        });
      }
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
    return { ok: false, status: 502, error: 'Invalid response format from Stanbic', details: parsed };
  }

  // Extract balance (handles array ["123.45"], string, number, etc.)
  const rawBalance: unknown = parsed.availableBalance ?? parsed.balance;
  const normalizedBalance = normalizeBalance(rawBalance);

  if (normalizedBalance === null) {
    return {
      ok: false,
      status: 502,
      error: 'Stanbic returned a response with no balance data',
      details: {
        raw: parsed,
        note: Object.keys(parsed).length === 0
          ? 'Empty response {} — the sandbox account may have no balance configured. Log into the Stanbic developer portal and verify the account linked to your API key has a test balance set.'
          : 'Response received but availableBalance field is missing or zero.',
      },
    };
  }

  // ─── Update Database ───────────────────────────────────────
  const { data: existingWallet, error: existingError } = await adminSupabase
    .from('admin_wallets')
    .select('id, name, balance, currency')
    .eq('name', 'Main Stanbic Source')
    .maybeSingle<Pick<AdminWallet, 'id' | 'name' | 'balance' | 'currency'>>();

  if (existingError) throw existingError;
  if (!existingWallet) {
    return { ok: false, status: 500, error: 'Admin wallet record not found' };
  }

  // Currency-drift guard: admin_wallets is always USD by platform convention.
  // A Stanbic response carrying anything else is a sync anomaly, not a real
  // currency change — never write it over the existing value.
  const currencyAnomaly = typeof parsed.currency === 'string' && parsed.currency !== 'USD';
  if (currencyAnomaly) {
    log.error('Stanbic sync returned a non-USD currency — refusing to update admin_wallets.currency', {
      returned: parsed.currency,
      existing: existingWallet.currency,
    });
  }
  const finalCurrency = existingWallet.currency || 'USD';

  // Suspicious drop protection
  if (isSuspiciousDrop(existingWallet.balance, normalizedBalance)) {
    log.error('Suspicious balance drop detected — manual review required', {
      previous: existingWallet.balance,
      incoming: normalizedBalance,
    });
    return {
      ok: false,
      status: 409,
      error: 'Suspicious balance drop detected. Manual review required.',
      details: { previous: existingWallet.balance, incoming: normalizedBalance },
    };
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
      ...(currencyAnomaly ? { currency_anomaly: true, currency_returned_by_stanbic: parsed.currency } : {}),
    },
  };

  const { error: txInsertError } = await adminSupabase
    .from('admin_wallet_transactions')
    .insert(txPayload);

  if (txInsertError) throw txInsertError;

  log.info('Stanbic sync complete', { balance: normalizedBalance, currency: finalCurrency, currencyAnomaly });

  return {
    ok: true,
    wallet: {
      id: existingWallet.id,
      balance: normalizedBalance,
      currency: finalCurrency,
      last_reconciled_at: nowIso,
    },
    currencyAnomaly,
  };
}
