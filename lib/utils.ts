import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export type { ClassValue }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currencyLocaleMap: Record<string, string> = {
  KES: 'en-KE',
  RWF: 'en-RW',
  TZS: 'sw-TZ',
  UGX: 'en-UG',
};

export function formatCurrency(
  amount: string | number | bigint,
  currency = 'KES'
) {
  const numericAmount = Number(amount);

  if (isNaN(numericAmount)) return '';

  const locale = currencyLocaleMap[currency] || 'en';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

export function formatDate(dateString: string | number | Date) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string | number | Date) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CalculateFeePercentageParams {
  crsTotal: number;
}
export function calculateFeePercentage({crsTotal}: CalculateFeePercentageParams) {
  const baseFee = 3.5;
  const riskAdjustment = 3.0;
  return baseFee + (riskAdjustment * (1 - crsTotal / 5));
}

export const COUNTRIES = [
  { code: 'KE', name: 'Kenya', currency: 'KES', mobileProviders: ['M-PESA', 'Airtel Money'] },
  { code: 'UG', name: 'Uganda', currency: 'UGX', mobileProviders: ['MTN Mobile Money', 'Airtel Money'] },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', mobileProviders: ['M-PESA', 'Tigo Pesa', 'Airtel Money'] },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', mobileProviders: ['MTN Mobile Money', 'Airtel Money'] },
];

export const EMPLOYMENT_TYPES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
];

export const PAYROLL_CYCLES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const DOCUMENT_TYPES = [
  { value: 'national_id', label: 'National ID Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'tax_certificate', label: 'Tax Compliance Certificate' },
  { value: 'payslip', label: 'Recent Payslip' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'employment_contract', label: 'Employment Contract' },
  { value: 'utility_bill', label: 'Utility Bill (Proof of Address)' },
];

interface GetRiskRatingColorParams {
  rating: string;
}

export function getRiskRatingColor({rating}: GetRiskRatingColorParams) {
  switch (rating?.toUpperCase()) {
    case 'A':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'B':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'C':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'D':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}

interface GetRiskRatingLabelParams {
  rating: string;
}

export function getRiskRatingLabel({rating}: GetRiskRatingLabelParams) {
  switch (rating?.toUpperCase()) {
    case 'A':
      return 'Low Risk';
    case 'B':
      return 'Medium Risk';
    case 'C':
      return 'High Risk';
    case 'D':
      return 'Very High Risk';
    default:
      return 'Not Scored';
  }
}

interface GetStatusColorParams {
  status: string;
}

export function getStatusColor({status}: GetStatusColorParams) : string | undefined {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'completed':
    case 'disbursed':
    case 'active':
      return 'bg-green-100 text-green-700';
    case 'pending':
    case 'submitted':
      return 'bg-amber-100 text-amber-700';
    case 'rejected':
    case 'failed':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

interface TruncateTextParams {
  text: string;
  maxLength?: number;
}
export function truncateText({text, maxLength = 50}: TruncateTextParams) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

interface GenerateInitialsParams {
  name: string;
}
export function generateInitials({name}: GenerateInitialsParams) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}