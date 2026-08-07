import type { supabaseAdmin } from '../supabaseAdmin';

// A completed payroll run is a stronger signal of an employer's real payday than
// the day-of-month they guessed at onboarding — payroll_uploads.processed_at is
// when they actually paid their staff. Falls back to the onboarding guess when no
// payroll run has been processed yet.
export async function resolveEffectivePaydayDayOfMonth(
  employerId: string,
  fallbackDayOfMonth: number | null,
  supabase: typeof supabaseAdmin,
): Promise<number | null> {
  const { data: lastPayroll } = await supabase
    .from('payroll_uploads')
    .select('processed_at')
    .eq('employer_live_id', employerId)
    .eq('status', 'processed')
    .not('processed_at', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastPayroll?.processed_at) {
    return new Date(lastPayroll.processed_at as string).getDate();
  }
  return fallbackDayOfMonth;
}

export function generateRepaymentReference(
  employerId: string,
  advanceId: string,
  dueDate: Date,
): string {
  const employerPart = employerId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const datePart = `${dueDate.getFullYear()}${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
  const advancePart = advanceId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `EWA-REP-${employerPart}-${datePart}-${advancePart}`;
}

// EWAPAYDAY<employer8><YYYYMMDD> = 9 + 8 + 8 = 25 chars — well under DusuPay's
// 36-char merchant_reference limit. DusuPay's collection endpoint rejects any
// non-alphanumeric characters in merchant_reference, so no hyphens here
// (unlike generateMerchantReference in lib/dusupay/utils.ts, which is only
// used for payouts and does allow hyphens).
export function generatePaydayRecoupmentReference(employerId: string, paydayDate: Date | string): string {
  const employerPart = employerId.replace(/-/g, '').slice(0, 8).toUpperCase();
  let datePart: string;
  if (typeof paydayDate === 'string') {
    datePart = paydayDate.replace(/-/g, '').slice(0, 8);
  } else {
    const year = paydayDate.getFullYear();
    const month = String(paydayDate.getMonth() + 1).padStart(2, '0');
    const day = String(paydayDate.getDate()).padStart(2, '0');
    datePart = `${year}${month}${day}`;
  }
  return `EWAPAYDAY${employerPart}${datePart}`;
}

export function isPaydayRecoupmentReference(reference: string): boolean {
  return reference.startsWith('EWAPAYDAY');
}

export function parseRepaymentReference(reference: string): {
  isRepayment: boolean;
  employerPrefix: string | null;
  datePart: string | null;
  advancePrefix: string | null;
} {
  if (!reference.startsWith('EWA-REP-')) {
    return { isRepayment: false, employerPrefix: null, datePart: null, advancePrefix: null };
  }
  const parts = reference.split('-');
  return {
    isRepayment: true,
    employerPrefix: parts[2] ?? null,
    datePart:       parts[3] ?? null,
    advancePrefix:  parts[4] ?? null,
  };
}
