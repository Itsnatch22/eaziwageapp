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
