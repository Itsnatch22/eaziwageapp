import type { SupabaseClient } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'employer' | 'employee';

export function normalizeAppRole(value: unknown): AppRole | null {
  if (typeof value !== 'string') return null;
  const n = value.trim().toLowerCase();
  if (n === 'admin' || n === 'employer' || n === 'employee') return n as AppRole;
  return null;
}

/**
 * Queries the four role-indicator tables to determine whether a user is an
 * employer or employee when the profiles table has no normalized role value.
 *
 * Accepts either a service-role client (login flow) or a user-scoped SSR
 * client (middleware flow) — both satisfy SupabaseClient.
 *
 * Returns null if the user has no record in any of the four tables; the
 * caller is responsible for providing a final fallback.
 */
export async function resolveRoleFromTables(
  supabase: SupabaseClient,
  userId: string,
): Promise<'employer' | 'employee' | null> {
  const [
    { data: employerOnboarding },
    { data: employerRecord },
    { data: employeeOnboarding },
    { data: employeeRecord },
  ] = await Promise.all([
    supabase.from('employer_onboarding').select('id').eq('user_id', userId).limit(1).maybeSingle(),
    supabase.from('employers').select('id').eq('user_id', userId).limit(1).maybeSingle(),
    supabase.from('employee_onboarding').select('id').eq('user_id', userId).limit(1).maybeSingle(),
    supabase.from('employees').select('id').eq('user_id', userId).limit(1).maybeSingle(),
  ]);

  if (employerOnboarding || employerRecord) return 'employer';
  if (employeeOnboarding || employeeRecord) return 'employee';
  return null;
}
