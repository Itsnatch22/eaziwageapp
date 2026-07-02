export enum PayoutMethod {
  MOBILE_MONEY = 'MOBILE_MONEY',
  BANK = 'BANK',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum Currency {
  KES = 'KES',
  TZS = 'TZS',
  UGX = 'UGX',
  RWF = 'RWF',
  USD = 'USD',
}

export type DusupayMetadata = Record<string, unknown>;

export interface PayoutRequest {
  merchant_reference: string;
  transaction_method: PayoutMethod;
  currency: Currency;
  amount: number;
  provider_code: string;
  account_number: string;
  customer_name: string;
  description: string;
  bank_code?: string;
}

// Collections use a distinct endpoint (/collections/initialize, confirmed against
// https://developer.dusupay.com/funds-collection/mobile-money-collection/mobile-money-direct-charge)
// with its own schema — notably `msisdn`, which /payout/send-funds explicitly
// rejects ("property msisdn should not exist").
export interface CollectionRequest {
  merchant_reference: string;
  transaction_method: PayoutMethod;
  currency: Currency;
  amount: number;
  provider_code: string;
  msisdn: string;
  customer_name: string;
  customer_email?: string;
  description: string;
  charge_customer?: boolean;
  allow_final_status_change?: boolean;
}

export interface CollectionResponse {
  code: number;
  status: string;
  message: string;
  data?: {
    internal_reference: string;
    merchant_reference: string;
  };
}

export interface PayoutResponse {
  code: number;
  status: string;
  message: string;
  data?: {
    merchant_reference: string;
    internal_reference: string;
    transaction_status: PayoutStatus;
    [key: string]: unknown;
  };
}

export interface WebhookPayload {
  event: 'transaction.completed' | 'transaction.failed' | 'request.failed' | string;
  payload: {
    id: number;
    merchant_reference: string;
    internal_reference: string;
    transaction_type: 'PAYOUT' | string;
    request_currency: string;
    transaction_amount: number;
    transaction_currency: string;
    transaction_charge: number;
    transaction_account: string;
    total_debit: number;
    provider_code: string;
    customer_name: string;
    transaction_status: 'COMPLETED' | 'FAILED' | string;
    status_message: string;
    [key: string]: unknown;
  };
}

export interface BalanceResponse {
  code: number;
  status: string;
  data: {
    wallet_balance: number;
    currency: string;
  }[];
}

export interface ProviderResponse {
  code: number;
  status: string;
  data: {
    provider_code: string;
    provider_name: string;
    transaction_method: PayoutMethod;
    currency: string;
    [key: string]: unknown;
  }[];
}

export interface BankCode {
  bank_code?: string;
  bank_name?: string;
  branch_code?: string;
  branch_name?: string;
  [key: string]: unknown;
}

export interface BankCodesResponse {
  code: number;
  status: string;
  data?: {
    payout_banks?: BankCode[];
    [key: string]: unknown;
  };
}

export interface SendFundsPayload {
  merchant_reference: string;
  transaction_method: PayoutMethod;
  currency: Currency;
  amount: number;
  provider_code: string;
  customer_name: string;
  description: string;
  msisdn?: string;
  account_number?: string;
  extra_params?: {
    bank_code?: string;
    [key: string]: string | undefined;
  };
}
