import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  verifyWebhookSignature: vi.fn(() => true),
  parseWebhook: vi.fn((body: Record<string, unknown>) => body),
  requestLogger: vi.fn(() => ({
    child: vi.fn().mockReturnThis(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  notifyEmployee: vi.fn(),
  notifyEmployer: vi.fn(),
  notifyAdmin: vi.fn(),
  applyPaydayRecoupmentCollection: vi.fn(),
}));
const upsertCalls: Array<{ table: string; values: unknown }> = [];

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.supabaseAdmin }));
vi.mock('@/lib/dusupay', () => ({
  dusupay: {
    verifyWebhookSignature: mocks.verifyWebhookSignature,
    parseWebhook: mocks.parseWebhook,
  },
}));
vi.mock('@/lib/logger', () => ({ requestLogger: mocks.requestLogger }));
vi.mock('@/lib/notifications', () => ({
  notifyEmployee: mocks.notifyEmployee,
  notifyEmployer: mocks.notifyEmployer,
  notifyAdmin: mocks.notifyAdmin,
}));
vi.mock('@/lib/repayment/utils', () => ({
  parseRepaymentReference: vi.fn(() => ({ isRepayment: false })),
}));
vi.mock('@/lib/services/payday-recoupment-service', () => ({
  applyPaydayRecoupmentCollection: mocks.applyPaydayRecoupmentCollection,
}));

import { POST } from '@/app/api/webhook/dusupay/route';

function queryResult(result: { data: unknown; error: unknown }, table: string) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'maybeSingle', 'single', 'upsert', 'insert', 'update', 'order', 'in']) {
    query[method] = vi.fn((...args: unknown[]) => {
      if (method === 'upsert') upsertCalls.push({ table, values: args[0] });
      return query;
    });
  }
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  query.maybeSingle = vi.fn(async () => result);
  query.single = vi.fn(async () => result);
  return query;
}

function signedRequest(event: string, merchantReference: string, status: string) {
  return new NextRequest('http://localhost/api/webhook/dusupay', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'dusupay-signature': 'valid-signature',
      'x-real-ip': '127.0.0.1',
    },
    body: JSON.stringify({
      event,
      payload: {
        merchant_reference: merchantReference,
        internal_reference: 'provider-ref',
        transaction_status: status,
        transaction_amount: 2500,
        transaction_currency: 'KES',
      },
    }),
  });
}

function mockDepDatabase() {
  let walletTransactionQuery = 0;
  mocks.supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'wallet_transactions') {
      const result = walletTransactionQuery++ === 0
        ? { data: null, error: null }
        : { data: { id: 'wallet-tx-1' }, error: null };
      return queryResult(result, table);
    }
    if (table === 'employer_wallets') {
      return queryResult({ data: { id: 'wallet-1' }, error: null }, table);
    }
    if (table === 'employer_onboarding') {
      return queryResult({ data: { user_id: null }, error: null }, table);
    }
    return queryResult({ data: null, error: null }, table);
  });
}

describe('DusuPay webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertCalls.length = 0;
    process.env.DUSUPAY_ALLOWED_IPS = '127.0.0.1';
    mockDepDatabase();
  });

  it('credits a completed DEP collection only once when callbacks arrive concurrently', async () => {
    let claimCount = 0;
    mocks.supabaseAdmin.rpc.mockImplementation(async (name: string) => {
      if (name === 'acquire_dusupay_webhook_claim') {
        claimCount += 1;
        return claimCount === 1
          ? { data: { claimed: true, claim_token: 'claim-1', reason: 'new' }, error: null }
          : { data: { claimed: false, reason: 'already_processing' }, error: null };
      }
      if (name === 'credit_employer_wallet_prefunded') return { data: null, error: null };
      if (name === 'finish_dusupay_webhook_claim') return { data: true, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });

    const [first, replay] = await Promise.all([
      POST(signedRequest('transaction.completed', 'DEP-employer-123', 'COMPLETED')),
      POST(signedRequest('transaction.completed', 'DEP-employer-123', 'COMPLETED')),
    ]);

    expect([200, 503]).toContain(first.status);
    expect([200, 503]).toContain(replay.status);
    expect(first.status).not.toBe(replay.status);
    expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledTimes(4);
    expect(mocks.supabaseAdmin.rpc.mock.calls.filter(([name]) => name === 'credit_employer_wallet_prefunded')).toHaveLength(1);
    expect(mocks.supabaseAdmin.rpc.mock.calls.filter(([name]) => name === 'finish_dusupay_webhook_claim')).toHaveLength(1);
  });

  it('releases the claim and returns a retryable error when the wallet credit fails', async () => {
    mocks.supabaseAdmin.rpc
      .mockResolvedValueOnce({
        data: { claimed: true, claim_token: 'claim-2', reason: 'new' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'ledger unavailable' } })
      .mockResolvedValueOnce({ data: true, error: null });

    const response = await POST(signedRequest('transaction.completed', 'DEP-employer-456', 'COMPLETED'));

    expect(response.status).toBe(500);
    expect(mocks.supabaseAdmin.rpc.mock.calls.at(-1)?.[0]).toBe('finish_dusupay_webhook_claim');
    expect(mocks.supabaseAdmin.rpc.mock.calls.at(-1)?.[1]).toMatchObject({ p_outcome: 'failed' });
    expect(mocks.supabaseAdmin.from).not.toHaveBeenCalledWith('dusupay_transactions');
  });

  it('records a pending collection as pending without crediting the wallet', async () => {
    mocks.supabaseAdmin.rpc
      .mockResolvedValueOnce({
        data: { claimed: true, claim_token: 'claim-3', reason: 'new' },
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });

    const response = await POST(signedRequest('transaction.pending', 'DEP-employer-789', 'PROCESSING'));

    expect(response.status).toBe(200);
    expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledTimes(2);
    expect(upsertCalls.find((call) => call.table === 'wallet_transactions')?.values)
      .toMatchObject({ status: 'pending' });
    expect(mocks.supabaseAdmin.rpc.mock.calls[0][0]).toBe('acquire_dusupay_webhook_claim');
    expect(mocks.supabaseAdmin.rpc.mock.calls[1][0]).toBe('finish_dusupay_webhook_claim');
  });

  it('fails closed when the atomic claim RPC errors', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });

    const response = await POST(signedRequest('transaction.completed', 'DEP-employer-000', 'COMPLETED'));

    expect(response.status).toBe(500);
    expect(mocks.supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('does not automatically replay a payday recoupment already flagged for ledger reconciliation', async () => {
    mocks.supabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'payday_recoupments') {
        return queryResult({
          data: {
            id: 'recoupment-1',
            employer_id: 'employer-1',
            amount_due: 5000,
            status: 'failed',
            failure_reason: 'RPC execution error during collection application',
          },
          error: null,
        }, table);
      }
      return queryResult({ data: null, error: null }, table);
    });
    mocks.supabaseAdmin.rpc
      .mockResolvedValueOnce({
        data: { claimed: true, claim_token: 'claim-4', reason: 'new' },
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });

    const response = await POST(signedRequest('transaction.completed', 'EWAPAYDAY-employer-999', 'COMPLETED'));

    expect(response.status).toBe(200);
    expect(mocks.applyPaydayRecoupmentCollection).not.toHaveBeenCalled();
    expect(mocks.supabaseAdmin.rpc.mock.calls.at(-1)?.[0]).toBe('finish_dusupay_webhook_claim');
  });
});
