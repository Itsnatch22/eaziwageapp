export interface OnboardingSubmissionState {
  status?: string | null;
  submitted_at: string | null;
}

export function hasSubmittedOnboarding(
  row: OnboardingSubmissionState | null,
): boolean {
  return row !== null && row.submitted_at != null;
}

export function shouldRedirectEmployerFromOnboarding(
  status: string | null | undefined,
  submittedAt: string | null | undefined,
  accountStatus: string | null | undefined,
): boolean {
  const accountOnHold =
    accountStatus === 'risk_review_in_progress' || accountStatus === 'suspended';
  return accountOnHold || (submittedAt != null && status !== 'rejected');
}
