export type PaymentMethodType = 'mobile_money' | 'bank_account';

export interface PaymentMethod {
  id: string;
  employee_id: string;
  country_code: string;
  method_type: PaymentMethodType;
  provider_name: string;
  account_name?: string | null;
  account_number?: string | null;
  phone_number?: string | null;
  is_default: boolean;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodCreate {
  country_code: string;
  method_type: PaymentMethodType;
  provider_name: string;
  account_name?: string | null;
  account_number?: string | null;
  phone_number?: string | null;
  is_default?: boolean;
}

export interface PayoutProviderConfig {
  provider_key: string;
  provider_name: string;
  method_type: PaymentMethodType;
  config?: Record<string, unknown> | null;
}

export interface PaymentMethodAudit {
  id: string;
  payment_method_id?: string | null;
  employee_id?: string | null;
  action: string;
  old_data?: unknown;
  new_data?: unknown;
  created_at: string;
}
