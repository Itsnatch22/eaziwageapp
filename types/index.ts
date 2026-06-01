
export type UserRole = 'super_admin' | 'employer_admin' | 'employee';
export type EmployeeStatus = 'approved' | 'pending' | 'rejected' | 'inactive' | 'terminated';
export type KYCStatus = 'approved' | 'pending' | 'submitted' | 'rejected';
export type CountryCode = 'KE' | 'UG' | 'TZ' | 'RW';
export type DisbursementChannel = 'mpesa' | 'airtel_money' | 'mtn_momo' | 'tigo_pesa' | 'bank_transfer';

export interface EWASettings {
  ewa_enabled: boolean;
  max_advance_percentage: number;
  min_advance_amount: number;
  max_advance_amount: number;
  cooldown_period: number;
}

export interface Employee {
  id: string;
  employer_id: string;
  full_name: string | null;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  monthly_salary: number | null;
  tenure_months: number | null;
  kyc_status: KYCStatus;
  status: EmployeeStatus;
  country: CountryCode;
  currency: string;
  phone_number: string | null;
  national_id: string | null;
  disbursement_channel: DisbursementChannel | null;
  ewa_settings: EWASettings | null;
  created_at: string;
  updated_at: string;
}

export interface Employer {
  id: string;
  user_id: string;
  company_name: string;
  full_name: string | null;
  country: CountryCode;
  currency: string;
  ewa_enabled: boolean;
  max_advance_percentage: number;
  min_advance_amount: number;
  max_advance_amount: number;
  cooldown_period: number;
  created_at: string;
}

export interface ExtendedStats {
  total_employees: number;
  active_employees: number;
  kyc_completion_rate: number;
  retention_rate: number;
  avg_tenure_months: number;
  new_hires_30_days: number;
  department_breakdown: Record<string, number>;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}