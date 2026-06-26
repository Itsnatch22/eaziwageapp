import { vi, describe, it, expect, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock factories — the returned object is used inside the factory.
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/env', () => ({
  getEnv: vi.fn(() => ({
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

import { runFraudChecks } from '@/lib/fraud-engine';

// Builds a chainable + awaitable mock query that resolves with `result`.
// Each chained method returns `self` so `.select().eq().limit()` all chain correctly.
// The `then` / `catch` / `finally` properties make `await query` work.
function q(result: { data: unknown; error: unknown }) {
  const self: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'single', 'in', 'update']) {
    self[m] = vi.fn(() => self);
  }
  self.then    = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
  self.catch   = (rej: (e: unknown) => unknown) => Promise.resolve(result).catch(rej);
  self.finally = (cb: () => void) => Promise.resolve(result).finally(cb);
  return self;
}

const BASE = {
  userId:     'user-001',
  employeeId: 'emp-001',
  employerId: 'er-001',
  amount:     5000,
};

// Default mock responses used across tests — overridden per-test as needed.
function setupDefaults() {
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'fraud_rules')  return q({ data: [],                      error: null });
    if (table === 'advances')     return q({ data: [],                      error: null });
    if (table === 'fraud_alerts') return q({ data: { id: 'alert-mock-1' }, error: null });
    return q({ data: null, error: null });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ─── Fail-closed behaviour ─────────────────────────────────────────────────

describe('fail-closed behaviour', () => {
  it('throws when the fraud_rules DB query errors (first attempt)', async () => {
    const dbError = { message: 'connection refused', code: '08006' };
    // Both attempts (original + retry) fail
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules') return q({ data: null, error: dbError });
      return q({ data: null, error: null });
    });

    await expect(runFraudChecks(BASE)).rejects.toThrow('Fraud engine unavailable');
  });

  it('thrown error carries code FRAUD_ENGINE_UNAVAILABLE', async () => {
    const dbError = { message: 'timeout', code: '57014' };
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules') return q({ data: null, error: dbError });
      return q({ data: null, error: null });
    });

    const err = await runFraudChecks(BASE).catch((e) => e);
    expect((err as { code?: string }).code).toBe('FRAUD_ENGINE_UNAVAILABLE');
  });

  it('does NOT return { isBlocked: false } on DB error (no silent approval)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules') return q({ data: null, error: { message: 'db error' } });
      return q({ data: null, error: null });
    });

    let result: unknown = null;
    await runFraudChecks(BASE).then((r) => { result = r; }).catch(() => { /* expected */ });
    expect(result).toBeNull(); // must have thrown, not resolved
  });
});

// ─── No rules configured ──────────────────────────────────────────────────

describe('no rules configured', () => {
  it('returns isBlocked=false with empty alerts when rule set is empty', async () => {
    // default mock already returns []
    const result = await runFraudChecks(BASE);
    expect(result.isBlocked).toBe(false);
    expect(result.alerts).toEqual([]);
  });

  it('returns isBlocked=false when rules is null (unexpected DB response)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules') return q({ data: null, error: null });
      return q({ data: null, error: null });
    });
    const result = await runFraudChecks(BASE);
    expect(result.isBlocked).toBe(false);
  });
});

// ─── amount_threshold rule ─────────────────────────────────────────────────

describe('amount_threshold rule', () => {
  const amountThresholdRule = {
    id: 'rule-amt-1',
    name: 'High amount',
    rule_type: 'amount_threshold',
    threshold_value: 10000,
    severity: 'high',
    action: 'block',
    enabled: true,
  };

  it('blocks when requested amount exceeds threshold', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules')  return q({ data: [amountThresholdRule], error: null });
      if (table === 'advances')     return q({ data: [],                    error: null });
      if (table === 'fraud_alerts') return q({ data: { id: 'a1' },         error: null });
      return q({ data: null, error: null });
    });

    const result = await runFraudChecks({ ...BASE, amount: 15000 });
    expect(result.isBlocked).toBe(true);
    expect(result.alerts.length).toBe(1);
  });

  it('does not block when amount is exactly at the threshold', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules') return q({ data: [amountThresholdRule], error: null });
      if (table === 'advances')    return q({ data: [],                    error: null });
      return q({ data: null, error: null });
    });

    // threshold_value = 10000, amount = 10000 → amount > threshold is false
    const result = await runFraudChecks({ ...BASE, amount: 10000 });
    expect(result.isBlocked).toBe(false);
    expect(result.alerts).toEqual([]);
  });

  it('flag-only rule (no block action) flags but does not block', async () => {
    const flagRule = { ...amountThresholdRule, action: 'flag' };
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules')  return q({ data: [flagRule],   error: null });
      if (table === 'advances')     return q({ data: [],           error: null });
      if (table === 'fraud_alerts') return q({ data: { id: 'a2' }, error: null });
      return q({ data: null, error: null });
    });

    const result = await runFraudChecks({ ...BASE, amount: 15000 });
    expect(result.isBlocked).toBe(false);
    expect(result.alerts.length).toBe(1);
  });
});

// ─── frequency rule ────────────────────────────────────────────────────────

describe('frequency rule', () => {
  const freqRule = {
    id: 'rule-freq-1',
    name: 'Too many requests',
    rule_type: 'frequency',
    threshold_value: 3,
    severity: 'medium',
    action: 'block',
    enabled: true,
  };

  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

  it('blocks when recent advance count >= threshold', async () => {
    const threeRecentAdvances = [
      { amount: 1000, created_at: sevenDaysAgo, status: 'completed' },
      { amount: 2000, created_at: sevenDaysAgo, status: 'approved'  },
      { amount: 3000, created_at: sevenDaysAgo, status: 'pending'   },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules')  return q({ data: [freqRule],              error: null });
      if (table === 'advances')     return q({ data: threeRecentAdvances,     error: null });
      if (table === 'fraud_alerts') return q({ data: { id: 'a3' },            error: null });
      return q({ data: null, error: null });
    });

    const result = await runFraudChecks(BASE);
    expect(result.isBlocked).toBe(true);
  });

  it('rejected advances are excluded from the frequency count', async () => {
    const rejectedAdvances = [
      { amount: 1000, created_at: sevenDaysAgo, status: 'rejected' },
      { amount: 2000, created_at: sevenDaysAgo, status: 'rejected' },
      { amount: 3000, created_at: sevenDaysAgo, status: 'rejected' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules') return q({ data: [freqRule],         error: null });
      if (table === 'advances')    return q({ data: rejectedAdvances,   error: null });
      return q({ data: null, error: null });
    });

    const result = await runFraudChecks(BASE);
    expect(result.isBlocked).toBe(false);
    expect(result.alerts).toEqual([]);
  });
});

// ─── velocity rule ─────────────────────────────────────────────────────────

describe('velocity rule', () => {
  const velocityRule = {
    id: 'rule-vel-1',
    name: 'Rapid requests',
    rule_type: 'velocity',
    threshold_value: 2,
    severity: 'critical',
    action: 'block',
    enabled: true,
  };

  it('blocks when 2+ advances in last hour', async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const recentAdvances = [
      { amount: 1000, created_at: twoMinutesAgo, status: 'pending' },
      { amount: 2000, created_at: twoMinutesAgo, status: 'approved' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules')  return q({ data: [velocityRule],    error: null });
      if (table === 'advances')     return q({ data: recentAdvances,    error: null });
      if (table === 'fraud_alerts') return q({ data: { id: 'a4' },      error: null });
      return q({ data: null, error: null });
    });

    const result = await runFraudChecks(BASE);
    expect(result.isBlocked).toBe(true);
  });

  it('does not block when advances are older than 1 hour', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const oldAdvances = [
      { amount: 1000, created_at: twoHoursAgo, status: 'approved' },
      { amount: 2000, created_at: twoHoursAgo, status: 'approved' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules') return q({ data: [velocityRule], error: null });
      if (table === 'advances')    return q({ data: oldAdvances,    error: null });
      return q({ data: null, error: null });
    });

    const result = await runFraudChecks(BASE);
    expect(result.isBlocked).toBe(false);
  });
});

// ─── alert insert failure ──────────────────────────────────────────────────

describe('alert insert failure handling', () => {
  it('continues and marks alert _unlogged when fraud_alerts insert fails', async () => {
    const rule = {
      id: 'rule-1', name: 'Test', rule_type: 'amount_threshold',
      threshold_value: 1000, severity: 'low', action: 'flag', enabled: true,
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'fraud_rules')  return q({ data: [rule],                         error: null });
      if (table === 'advances')     return q({ data: [],                              error: null });
      if (table === 'fraud_alerts') return q({ data: null, error: { message: 'db error' } });
      return q({ data: null, error: null });
    });

    const result = await runFraudChecks({ ...BASE, amount: 5000 });
    expect(result.alerts.length).toBe(1);
    expect(result.alerts[0]._unlogged).toBe(true);
  });
});
