import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '@/lib/logger';
import { getStanbicStatementsClientForCurrency } from './client';

export interface FetchStatementResult {
  ok: boolean;
  status: number;
  error?: string;
  inserted?: number;
  zeroRecords?: boolean;
}

function parseStanbicDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length !== 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function normalizeStatementItem(item: Record<string, unknown>) {
  const rawAmount = item['TxnAmount'];
  const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount)
    : typeof rawAmount === 'number' ? rawAmount : null;

  const rawBalance = item['RemainingBalance'];
  const remainingBalance = typeof rawBalance === 'string' ? parseFloat(rawBalance)
    : typeof rawBalance === 'number' ? rawBalance : null;

  return {
    stanbic_transaction_id: String(item['T24UniqRef'] ?? ''),
    booking_date: parseStanbicDate(item['TransactionDate']),
    value_date: parseStanbicDate(item['ValueDate']),
    from_account_no: typeof item['FromAcctNo'] === 'string' ? item['FromAcctNo'] : null,
    to_account_no: typeof item['ToAcctNo'] === 'string' ? item['ToAcctNo'] : null,
    transaction_type: typeof item['TransactionType'] === 'string' ? item['TransactionType'] : null,
    amount: Number.isFinite(amount) ? amount : null,
    currency_code: typeof item['TxnCurrency'] === 'string' ? item['TxnCurrency'] : null,
    remaining_balance: Number.isFinite(remainingBalance) ? remainingBalance : null,
    description: typeof item['TxnDescr'] === 'string' ? item['TxnDescr'] : null,
    raw_response: item,
  };
}

export async function fetchStanbicStatement(
  adminSupabase: SupabaseClient,
  log: Logger | { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void },
  params: { walletId: string; currency: string; accountNumber: string; fromDate: string; toDate: string; noOfTxns?: string },
): Promise<FetchStatementResult> {
  const { walletId, currency, accountNumber, fromDate, toDate, noOfTxns } = params;
  const client = getStanbicStatementsClientForCurrency(currency);

  let request;
  try {
    request = await client.buildStatementRequest(accountNumber, fromDate, toDate, noOfTxns);
  } catch (err) {
    log.error('Failed to build Stanbic statement request', { err: err instanceof Error ? err.message : String(err) });
    return { ok: false, status: 502, error: 'Failed to authenticate with Stanbic statement API' };
  }

  let resp: Response;
  try {
    resp = await fetch(request.url, { method: 'POST', headers: request.headers, body: request.body });
  } catch (err) {
    log.error('Network error calling Stanbic statement API', { err: err instanceof Error ? err.message : String(err) });
    return { ok: false, status: 502, error: 'Network error calling Stanbic statement API' };
  }

  const raw = await resp.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    log.error('Stanbic statement API returned non-JSON response', { status: resp.status, raw: raw.slice(0, 500) });
    return { ok: false, status: 502, error: 'Stanbic statement API returned an unparseable response' };
  }

  const responseCode = parsed && typeof parsed['ResponseCode'] === 'string' ? parsed['ResponseCode'] : null;
  if (!resp.ok || responseCode !== '00') {
    log.error('Stanbic statement API non-success response', { status: resp.status, responseCode, body: parsed });
    return { ok: false, status: resp.ok ? 502 : resp.status, error: `Stanbic statement API returned ResponseCode=${responseCode ?? 'unknown'}` };
  }

  const items = Array.isArray(parsed?.['TransactionHistory'])
    ? (parsed!['TransactionHistory'] as Record<string, unknown>[])
    : [];

  if (items.length === 0) {
    log.info('Stanbic statement: zero records in range', { walletId, fromDate, toDate });
    return { ok: true, status: 200, inserted: 0, zeroRecords: true };
  }

  const rows = items.map((item) => ({ admin_wallet_id: walletId, ...normalizeStatementItem(item) }));

  const { error: insertError, count } = await adminSupabase
    .from('stanbic_statement_transactions')
    .upsert(rows, { onConflict: 'admin_wallet_id,stanbic_transaction_id', ignoreDuplicates: true, count: 'exact' });

  if (insertError) {
    log.error('Failed to persist Stanbic statement rows', { err: insertError.message });
    return { ok: false, status: 500, error: 'Failed to persist statement rows' };
  }

  return { ok: true, status: 200, inserted: count ?? rows.length };
}