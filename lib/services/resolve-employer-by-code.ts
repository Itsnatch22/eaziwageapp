import type { SupabaseClient } from '@supabase/supabase-js';

export type ResolveEmployerResult =
  | {
      status: 'resolved';
      onboardingId: string;
      liveEmployerId: string | null;
      userId: string;
      companyName: string;
    }
  | { status: 'not_found' }
  | { status: 'rejected' }
  | { status: 'suspended' }
  | { status: 'not_approved' };

interface OnboardingRow {
  id: string;
  user_id: string;
  status: string;
  company_name: string | null;
}

interface EmployerRow {
  id: string;
  onboarding_id: string | null;
}

/**
 * Looks up an approved employer by company code, checking employer_onboarding
 * (the canonical source, populated at registration and admin approval) before
 * falling back to the employers table for records pre-dating the onboarding
 * backfill migration. Consolidates what were two near-identical, differently-
 * ordered lookups in app/api/auth/register/route.ts and
 * app/api/employee-dashboard/onboarding/route.ts.
 *
 * Returns a discriminated result rather than a bare null/row so callers can
 * still surface the same specific messaging the register route already did
 * (unknown code vs. rejected/suspended employer vs. still-pending employer).
 */
export async function resolveEmployerByCode(
  adminSupabase: SupabaseClient,
  code: string,
): Promise<ResolveEmployerResult> {
  const trimmed = code.trim();
  if (!trimmed) return { status: 'not_found' };

  let onboarding: OnboardingRow | null = null;

  const { data: onboardingByCode } = await adminSupabase
    .from('employer_onboarding')
    .select('id, user_id, status, company_name')
    .ilike('company_code', trimmed)
    .maybeSingle<OnboardingRow>();

  if (onboardingByCode) {
    onboarding = onboardingByCode;
  } else {
    const { data: employerByCode } = await adminSupabase
      .from('employers')
      .select('id, onboarding_id')
      .or(`company_code.ilike.${trimmed},employer_code.ilike.${trimmed}`)
      .maybeSingle<EmployerRow>();

    if (employerByCode?.onboarding_id) {
      const { data: linked } = await adminSupabase
        .from('employer_onboarding')
        .select('id, user_id, status, company_name')
        .eq('id', employerByCode.onboarding_id)
        .maybeSingle<OnboardingRow>();
      onboarding = linked ?? null;
    }
  }

  if (!onboarding) return { status: 'not_found' };
  if (onboarding.status === 'rejected') return { status: 'rejected' };
  if (onboarding.status === 'suspended') return { status: 'suspended' };
  if (onboarding.status !== 'approved') return { status: 'not_approved' };

  const { data: liveEmployer } = await adminSupabase
    .from('employers')
    .select('id')
    .eq('onboarding_id', onboarding.id)
    .maybeSingle<{ id: string }>();

  return {
    status: 'resolved',
    onboardingId: onboarding.id,
    liveEmployerId: liveEmployer?.id ?? null,
    userId: onboarding.user_id,
    companyName: onboarding.company_name ?? 'Unknown company',
  };
}
