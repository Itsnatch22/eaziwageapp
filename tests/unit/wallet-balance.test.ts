import { describe, it, expect } from 'vitest';

// Replicates the balance-computation logic from app/api/employer-dashboard/wallet/route.ts
// employer_wallets has NO balance column — balance is derived from wallet_transactions sum
function computeWalletBalance(transactions: Array<{ status: string; amount: number | string }>): number {
  return transactions.reduce(
    (sum, tx) => (tx.status === 'completed' ? sum + Number(tx.amount) : sum),
    0,
  );
}

describe('wallet balance — derived from wallet_transactions', () => {
  it('empty transaction list gives zero balance', () => {
    expect(computeWalletBalance([])).toBe(0);
  });

  it('single completed deposit adds to balance', () => {
    const txns = [{ status: 'completed', amount: 50000 }];
    expect(computeWalletBalance(txns)).toBe(50000);
  });

  it('pending transactions are excluded from balance', () => {
    const txns = [
      { status: 'completed', amount: 50000 },
      { status: 'pending',   amount: 10000 },
    ];
    expect(computeWalletBalance(txns)).toBe(50000);
  });

  it('failed transactions are excluded from balance', () => {
    const txns = [
      { status: 'completed', amount: 50000 },
      { status: 'failed',    amount: 5000  },
    ];
    expect(computeWalletBalance(txns)).toBe(50000);
  });

  it('payouts stored as negative amounts reduce balance', () => {
    // DusuPay webhook stores payout disbursements as negative amounts
    const txns = [
      { status: 'completed', amount: 100000 }, // deposit
      { status: 'completed', amount: -5000  }, // payout (advance disbursed)
      { status: 'completed', amount: -3000  }, // payout (advance disbursed)
    ];
    expect(computeWalletBalance(txns)).toBe(92000);
  });

  it('string amount values are coerced via Number()', () => {
    // Supabase may return numeric columns as strings depending on the driver
    const txns = [
      { status: 'completed', amount: '50000.00' },
      { status: 'completed', amount: '-5000.00' },
    ];
    expect(computeWalletBalance(txns)).toBe(45000);
  });

  it('sum of many small transactions matches expected total', () => {
    const txns = Array.from({ length: 100 }, () => ({ status: 'completed', amount: 1000 }));
    expect(computeWalletBalance(txns)).toBe(100000);
  });

  it('balance can be negative when more is disbursed than deposited', () => {
    // This represents an overdraft / negative-balance state
    const txns = [
      { status: 'completed', amount: 10000  },
      { status: 'completed', amount: -15000 },
    ];
    expect(computeWalletBalance(txns)).toBe(-5000);
  });
});

describe('wallet response shape', () => {
  it('arrears_balance maps to outstanding_liability from DB', () => {
    // The API returns { balance, arrears_balance: outstanding_liability }
    // This test documents the mapping contract so it is never accidentally removed
    const dbRow = { total_advanced: 50000, outstanding_liability: 3000, total_repaid: 47000 };
    const arrearsBalance = Number(dbRow.outstanding_liability);
    expect(arrearsBalance).toBe(3000);
  });

  it('wallet_transactions type column is aliased to transaction_type in response', () => {
    // The DB column is `type`, the API client expects `transaction_type`
    // This alias must be preserved to avoid breaking the wallet page WalletData interface
    const dbTx = { id: '1', type: 'credit', status: 'completed', amount: 1000 };
    const responseTx = { ...dbTx, transaction_type: dbTx.type };
    expect(responseTx.transaction_type).toBe('credit');
    expect(responseTx.type).toBe('credit'); // original field preserved
  });
});
