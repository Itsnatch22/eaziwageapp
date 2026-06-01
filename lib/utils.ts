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
  USD: 'en-US',
};

const currencySymbolMap: Record<string, string> = {
  KES: 'KSh',
  RWF: 'RF',
  TZS: 'TSh',
  UGX: 'USh',
  USD: '$',
};

export const DEFAULT_ADMIN_CURRENCY = 'USD';

const countryCurrencyMap: Record<string, string> = {
  KE: 'KES',
  UG: 'UGX',
  TZ: 'TZS',
  RW: 'RWF',
};

const countryNameToCodeMap: Record<string, string> = {
  KENYA: 'KE',
  UGANDA: 'UG',
  TANZANIA: 'TZ',
  RWANDA: 'RW',
};

export function normalizeCountryCode(country: string | null | undefined): string | undefined {
  if (!country) return undefined;
  const normalized = country.trim().toUpperCase();
  if (countryCurrencyMap[normalized]) return normalized;
  return countryNameToCodeMap[normalized];
}

export function getCurrencyFromCountry(
  country: string | null | undefined,
  fallbackCurrency = 'KES'
) {
  const code = normalizeCountryCode(country);
  return code ? countryCurrencyMap[code] : fallbackCurrency;
}

export function formatCurrency(
  amount: string | number | bigint,
  currency = 'KES'
) {
  const numericAmount = Number(amount);

  if (isNaN(numericAmount)) return '';

  const normalizedCurrency = (currency || 'KES').toUpperCase();
  const locale = currencyLocaleMap[normalizedCurrency] || 'en-KE';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  } catch {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  }
}

export function getCurrencySymbol(currency: string = 'KES') {
  const normalizedCurrency = (currency || 'KES').toUpperCase();
  return currencySymbolMap[normalizedCurrency] || normalizedCurrency;
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

export function calculateFeePercentage(crsTotal: number) {
  const baseFee = 3.5;
  const riskAdjustment = 3.0;
  return baseFee + (riskAdjustment * (1 - crsTotal / 5));
}

export const COUNTRIES = [
  { code: 'KE', name: 'Kenya', currency: 'KES', mobileProviders: ['M-PESA', 'Airtel Money'], advanceLimit: 50 },
  { code: 'UG', name: 'Uganda', currency: 'UGX', mobileProviders: ['MTN Mobile Money', 'Airtel Money'], advanceLimit: 60 },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', mobileProviders: ['M-PESA', 'Tigo Pesa', 'Airtel Money'], advanceLimit: 30 },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', mobileProviders: ['MTN Mobile Money', 'Airtel Money'], advanceLimit: 45 },
];

export function getAdvanceLimit(country: string | null | undefined): number {
  const code = normalizeCountryCode(country);
  const countryData = COUNTRIES.find(c => c.code === code);
  return countryData?.advanceLimit ?? 50; // Default to 50%
}

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

export function getRiskRatingColor(rating: string) {
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

export function getRiskRatingLabel(rating: string) {
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

export function convertToUSD(amount: number, currency: string, rates: Record<string, number>): number {
  if (currency.toUpperCase() === 'USD') return amount;
  const rate = rates[currency.toUpperCase()];
  if (!rate) return amount;
  return amount / rate;
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
