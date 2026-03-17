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

export interface PayoutRequest {
  merchant_reference: string;
  transaction_method: PayoutMethod;
  currency: Currency;
  amount: number;
  provider_code: string;
  account_number: string; // msisdn for MM, account_number for Bank
  customer_name: string;
  description: string;
  bank_code?: string;
}

export interface PayoutResponse {
  code: number;
  status: string;
  message: string;
  data?: {
    merchant_reference: string;
    internal_reference: string;
    transaction_status: PayoutStatus;
    [key: string]: any;
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
    [key: string]: any;
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
    [key: string]: any;
  }[];
}
