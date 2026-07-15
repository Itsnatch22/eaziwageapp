import type { SupabaseClient } from '@supabase/supabase-js';

export type DashboardRole = 'employee' | 'employer';

/**
 * Mirrors the role-resolution precedence in lib/stores/auth.ts's
 * fetchUserRole (employer_onboarding before employee_onboarding), mapped to
 * the 2-value enum satisfaction_feedback.role actually needs. A user with
 * neither record (e.g. an admin, who lives only in system_admins) resolves
 * to null — the CSAT prompt is never mounted on admin pages, but every
 * satisfaction API route re-checks this server-side rather than trusting
 * that the request came from a dashboard that gates on role client-side.
 */
export async function resolveDashboardRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardRole | null> {
  const { data: employer } = await supabase
    .from('employer_onboarding')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (employer) return 'employer';

  const { data: employee } = await supabase
    .from('employee_onboarding')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (employee) return 'employee';

  return null;
}
