import type { SupabaseClient } from '@supabase/supabase-js';
import { buildStanbicBalanceRequest, getStanbicBalanceAccountMode } from './client';
import type { Logger } from '../logger';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminWallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  country_code?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  branch_name?: string | null;
  branch_code?: string | null;
  bank_code?: string | null;
  swift_code?: string | null;
  paybill_number?: string | null;
  supports_mpesa_deposit?: boolean | null;
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

function normalizeAccountId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function extractStanbicCurrency(parsed: Record<string, unknown>): string | null {
  const candidates = [
    parsed.currency,
    parsed.currencyCode,
    parsed.accountCurrency,
    parsed.account_currency,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().toUpperCase();
  }

  const accounts = parsed.accounts ?? parsed.data ?? parsed.result;
  if (Array.isArray(accounts) && accounts.length > 0 && isRecord(accounts[0])) {
    return extractStanbicCurrency(accounts[0]);
  }
  if (isRecord(accounts)) return extractStanbicCurrency(accounts);

  return null;
}

function extractStanbicAccountNumber(parsed: Record<string, unknown>): string | null {
  const candidates = [
    parsed.accountNumber,
    parsed.account_number,
    parsed.accountId,
    parsed.account_id,
    parsed.account,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number') return String(candidate);
  }

  const accounts = parsed.accounts ?? parsed.data ?? parsed.result;
  if (Array.isArray(accounts) && accounts.length > 0 && isRecord(accounts[0])) {
    return extractStanbicAccountNumber(accounts[0]);
  }
  if (isRecord(accounts)) return extractStanbicAccountNumber(accounts);

  return null;
}

function accountMatches(returnedAccount: string, expectedAccount: string): boolean {
  const returned = normalizeAccountId(returnedAccount);
  const expected = normalizeAccountId(expectedAccount);
  return returned === expected || (expected.length >= 6 && returned.includes(expected));
}

// Manual admin_deposit() entries aren't flagged the moment a sync doesn't yet
// reflect them — a real bank deposit can take a business day or more to clear
// and show up in Stanbic's own balance. Only flag ones that are still
// unaccounted for after this long.
const RECONCILIATION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

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
  walletSelector: { id?: string; countryCode?: string; currency?: string } = {},
): Promise<StanbicSyncResult> {
  // ─── Load selected wallet first so Stanbic account selection is explicit ──
  let walletQuery = adminSupabase
    .from('admin_wallets')
    .select('id, name, balance, currency, country_code, account_number, bank_name, branch_name, branch_code, bank_code, swift_code, paybill_number, supports_mpesa_deposit');

  if (walletSelector.id) {
    walletQuery = walletQuery.eq('id', walletSelector.id);
  } else if (walletSelector.countryCode && walletSelector.currency) {
    walletQuery = walletQuery
      .eq('country_code', walletSelector.countryCode.toUpperCase())
      .eq('currency', walletSelector.currency.toUpperCase());
  } else {
    walletQuery = walletQuery.eq('name', 'Main Stanbic Source');
  }

  const { data: existingWallet, error: existingError } = await walletQuery
    .maybeSingle<AdminWallet>();

  if (existingError) throw existingError;
  if (!existingWallet) {
    return { ok: false, status: 500, error: 'Admin wallet record not found' };
  }

  const accountMode = getStanbicBalanceAccountMode();
  if (existingWallet.account_number && accountMode === 'none') {
    return {
      ok: false,
      status: 500,
      error: 'Selected wallet has a Stanbic account number, but STANBIC_BALANCE_ACCOUNT_MODE is not configured',
    };
  }

  if (accountMode !== 'none' && !existingWallet.account_number) {
    return {
      ok: false,
      status: 500,
      error: `Selected wallet ${existingWallet.name} has no Stanbic account number configured`,
    };
  }

  // ─── Build authenticated, account-aware Stanbic request ───────────────────
  let balanceRequest: Awaited<ReturnType<typeof buildStanbicBalanceRequest>>;
  try {
    balanceRequest = await buildStanbicBalanceRequest({
      accountNumber: existingWallet.account_number,
      currency: existingWallet.currency,
      countryCode: existingWallet.country_code,
    });
  } catch (requestErr) {
    const m = requestErr instanceof Error ? requestErr.message : String(requestErr);
    log.error('Stanbic request preparation failed', { err: m, walletId: existingWallet.id });
    return { ok: false, status: 500, error: m };
  }
  log.info('Calling Stanbic balance endpoint', {
    walletId: existingWallet.id,
    currency: existingWallet.currency,
    accountMode,
  });

  // ─── Fetch from Stanbic ─────────────────────────────────────
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  let stanbicRes: Response;
  try {
    stanbicRes = await fetch(balanceRequest.url, {
      method: balanceRequest.method,
      headers: balanceRequest.headers,
      body: balanceRequest.body,
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
      const json = JSON.parse(rawText) as unknown;
      parsed = isRecord(json) ? json : { data: json };
      log.info('Stanbic response parsed', { keys: Object.keys(parsed) });
      if (Object.keys(parsed).length === 0) {
        const headerDump: Record<string, string> = {};
        stanbicRes.headers.forEach((v, k) => { headerDump[k] = v; });
        log.warn('Stanbic returned an empty object — no balance data', {
          responseHeaders: headerDump,
          rawBody: rawText.slice(0, 500),
        });
      }
    } else {
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
  const rawBalance: unknown = parsed.availableBalance ?? parsed.balance ?? parsed.data;
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

  // Currency-drift guard: each admin_wallet row has its own home currency.
  // A Stanbic response carrying any other currency is a sync anomaly, not a
  // signal to overwrite the ledger account's configured currency.
  const returnedCurrency = extractStanbicCurrency(parsed);
  const currencyAnomaly = returnedCurrency !== null && returnedCurrency !== existingWallet.currency.toUpperCase();
  if (currencyAnomaly) {
    log.error('Stanbic sync returned a currency different from the selected admin wallet — refusing to update wallet balance', {
      returned: returnedCurrency,
      existing: existingWallet.currency,
    });
    return {
      ok: false,
      status: 409,
      error: `Stanbic returned ${returnedCurrency}, but selected wallet is ${existingWallet.currency}`,
      details: { returnedCurrency, walletCurrency: existingWallet.currency },
    };
  }

  const returnedAccount = extractStanbicAccountNumber(parsed);
  if (
    existingWallet.account_number
    && returnedAccount
    && !accountMatches(returnedAccount, existingWallet.account_number)
  ) {
    log.error('Stanbic sync returned an account different from the selected admin wallet — refusing to update wallet balance', {
      returned: returnedAccount,
      expected: existingWallet.account_number,
      walletId: existingWallet.id,
    });
    return {
      ok: false,
      status: 409,
      error: 'Stanbic returned a different account than the selected wallet',
      details: { returnedAccount, expectedAccount: existingWallet.account_number },
    };
  }
  const finalCurrency = existingWallet.currency || walletSelector.currency || 'USD';

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

  // ─── Manual-deposit reconciliation ───────────────────────────
  // Compare Stanbic's real, just-fetched balance against manually-recorded
  // admin_deposit() entries that haven't been confirmed by a sync yet. This
  // never blocks or alters the sync itself — it only marks deposits as
  // confirmed, or (after a grace period) raises a flag for admin review.
  const { data: unreconciledDeposits, error: unreconciledError } = await adminSupabase
    .from('admin_wallet_transactions')
    .select('id, amount, created_at')
    .eq('admin_wallet_id', existingWallet.id)
    .eq('type', 'stanbic_deposit')
    .eq('reconciled', false)
    .order('created_at', { ascending: true });

  if (unreconciledError) {
    log.error('Failed to fetch unreconciled Stanbic deposits — skipping reconciliation check', {
      err: unreconciledError.message,
    });
  } else if (unreconciledDeposits && unreconciledDeposits.length > 0) {
    if (normalizedBalance >= existingWallet.balance) {
      // Stanbic's real balance has caught up to (or exceeds) what we had
      // recorded, including the manual deposits — treat them as confirmed.
      const { error: reconcileError } = await adminSupabase
        .from('admin_wallet_transactions')
        .update({ reconciled: true })
        .in('id', unreconciledDeposits.map((d) => d.id))
        .eq('reconciled', false);
      if (reconcileError) {
        log.error('Failed to mark manual deposits as reconciled', { err: reconcileError.message });
      } else {
        log.info('Manual Stanbic deposits reconciled', { count: unreconciledDeposits.length });
      }
    } else {
      // Stanbic's real balance is lower than what we're carrying — one or
      // more manual deposits may not actually be reflected. Flag only the
      // ones old enough that a normal clearing delay no longer explains it;
      // the unique(wallet_transaction_id, status) constraint makes this
      // idempotent across repeated sync runs.
      const now = Date.now();
      const staleDeposits = unreconciledDeposits.filter(
        (d) => now - new Date(d.created_at).getTime() > RECONCILIATION_GRACE_PERIOD_MS,
      );
      for (const deposit of staleDeposits) {
        const { error: flagError } = await adminSupabase
          .from('stanbic_deposit_reconciliation_flags')
          .upsert(
            {
              admin_wallet_id: existingWallet.id,
              wallet_transaction_id: deposit.id,
              recorded_amount: deposit.amount,
              balance_before_sync: existingWallet.balance,
              stanbic_reported_balance: normalizedBalance,
              status: 'pending_review',
            },
            { onConflict: 'wallet_transaction_id,status', ignoreDuplicates: true },
          );
        if (flagError) {
          log.error('Failed to raise Stanbic deposit reconciliation flag', {
            err: flagError.message,
            wallet_transaction_id: deposit.id,
          });
        } else {
          log.warn('Manual Stanbic deposit unaccounted for after grace period — flagged for review', {
            wallet_transaction_id: deposit.id,
            recorded_amount: deposit.amount,
          });
        }
      }
    }
  }

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
      account_number: existingWallet.account_number,
      source: 'stanbic_balance_api',
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
