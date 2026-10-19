export interface OnboardingSubmissionState {
  status: string | null;
  submitted_at: string | null;
}

export function hasSubmittedOnboarding(
  row: OnboardingSubmissionState | null,
): boolean {
  return row !== null && (row.submitted_at !== null || row.status === 'approved');
}
