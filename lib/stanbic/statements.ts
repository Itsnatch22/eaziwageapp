import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '@/lib/logger';
import { getStanbicStatementsClientForCurrency } from './client';

interface FetchStatementParams {
  walletId: string;
  accountNumber: string;
  currency: string;
}

interface FetchStatementResult {
  ok: boolean;
  status: number;
  error?: string;
  inserted?: number;
  zeroRecords?: boolean;
}

// PROVISIONAL: field mapping follows the documented swagger schema
// (GetTransactionResponse). Not yet validated against a real Stanbic
// response — every attempt so far hit a T24 backend error before
// returning transaction data. Confirm field names against a real payload
// before trusting this in production.
function normalizeStatementItem(item: Record<string, unknown>) {
  const amountObj = item['transactionAmountCurrency'] as Record<string, unknown> | undefined;
  const rawAmount = amountObj?.['amount'];
  const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount)
    : typeof rawAmount === 'number' ? rawAmount : null;

  return {
    stanbic_transaction_id: String(item['id'] ?? ''),
    booking_date: typeof item['bookingDate'] === 'string' ? item['bookingDate'] : null,
    value_date: typeof item['valueDate'] === 'string' ? item['valueDate'] : null,
    credit_debit_indicator: typeof item['creditDebitIndicator'] === 'string' ? item['creditDebitIndicator'] : null,
    amount: Number.isFinite(amount) ? amount : null,
    currency_code: typeof amountObj?.['currencyCode'] === 'string' ? amountObj['currencyCode'] as string : null,
    counter_party_name: typeof item['counterPartyName'] === 'string' ? item['counterPartyName'] : null,
    counter_party_account_number: typeof item['counterPartyAccountNumber'] === 'string' ? item['counterPartyAccountNumber'] : null,
    description: typeof item['description'] === 'string' ? item['description'] : null,
    category: typeof item['category'] === 'string' ? item['category'] : null,
    raw_response: item,
  };
}

export async function fetchStanbicStatement(
   adminSupabase: SupabaseClient,
   log: Logger,
   params: FetchStatementParams,
): Promise<FetchStatementResult> {
  const { walletId, accountNumber, currency } = params;
  const client = getStanbicStatementsClientForCurrency(currency);

  let request;
  try {
    request = await client.buildStatementRequest(accountNumber);
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

  const errorCode = parsed && typeof parsed['errorCode'] === 'string' ? parsed['errorCode'] : null;
  if (errorCode === '2001') {
    log.info('Stanbic statement: zero records', { walletId, accountNumber });
    return { ok: true, status: 200, inserted: 0, zeroRecords: true };
  }

  if (!resp.ok) {
    log.error('Stanbic statement API error response', { status: resp.status, body: parsed });
    return { ok: false, status: resp.status, error: 'Stanbic statement API returned an error' };
  }

  const items = Array.isArray(parsed?.['transaction-items'])
    ? (parsed!['transaction-items'] as Record<string, unknown>[])
    : [];

  if (items.length === 0) {
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