import { supabaseAdmin } from '../supabaseAdmin';

/**
 * Treasury validation and management service.
 * Handles checks for sufficient funds before disbursements and related queries.
 */

export interface TreasuryWallet {
  id: string;
  balance: number;
  country_code: string;
  currency: string;
}

export class TreasuryValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TreasuryValidationError';
  }
}

/**
 * Validate and retrieve treasury wallet for a given currency and country.
 * Throws TreasuryValidationError if wallet not found or insufficient balance.
 */
export async function validateTreasuryBalance(
  amount: number,
  currency: string,
  countryCode: string,
): Promise<TreasuryWallet> {
  const { data: wallet, error: walletError } = await supabaseAdmin
    .from('admin_wallets')
    .select('id, balance, country_code, currency')
    .eq('country_code', countryCode)
    .eq('currency', currency)
    .maybeSingle();

  if (walletError) {
    throw new TreasuryValidationError(
      'treasury_query_error',
      `Failed to query treasury wallet for ${currency}-${countryCode}: ${walletError.message}`,
      { currency, countryCode, originalError: walletError.message },
    );
  }

  if (!wallet) {
    throw new TreasuryValidationError(
      'treasury_not_configured',
      `No ${currency}-${countryCode} treasury account is configured for this payout`,
      { currency, countryCode },
    );
  }

  const currentBalance = Number(wallet.balance ?? 0);
  if (currentBalance < amount) {
    throw new TreasuryValidationError(
      'insufficient_treasury_balance',
      `Insufficient ${currency}-${countryCode} treasury balance for this payout. ` +
      `Required: ${amount.toFixed(2)} ${currency}, Available: ${currentBalance.toFixed(2)} ${currency}`,
      {
        currency,
        countryCode,
        required: amount,
        available: currentBalance,
        shortfall: amount - currentBalance,
      },
    );
  }

  return wallet as TreasuryWallet;
}

/**
 * Get treasury wallet status for monitoring and alerts.
 * Returns wallet info without throwing on missing wallet (returns null instead).
 */
export async function getTreasuryWalletStatus(
  currency: string,
  countryCode: string,
): Promise<TreasuryWallet | null> {
  const { data: wallet } = await supabaseAdmin
    .from('admin_wallets')
    .select('id, balance, country_code, currency')
    .eq('country_code', countryCode)
    .eq('currency', currency)
    .maybeSingle();

  return wallet as TreasuryWallet | null;
}

/**
 * List all configured treasury wallets with their current balances.
 */
export async function listTreasuryWallets(): Promise<TreasuryWallet[]> {
  const { data: wallets, error } = await supabaseAdmin
    .from('admin_wallets')
    .select('id, balance, country_code, currency');

  if (error) {
    console.error('[treasury-service] Failed to list wallets:', error);
    return [];
  }

  return wallets as TreasuryWallet[];
}
