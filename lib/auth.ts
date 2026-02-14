import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface Organization {
  id: string;
  country: string;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored in contexts where setting cookies is not supported.
          }
        },
      },
    }
  );
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getCurrentOrganization(): Promise<Organization | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return null;
  }

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('id, country')
    .eq('id', profile.organization_id)
    .single();

  if (orgError || !organization) {
    return null;
  }

  return organization as Organization;
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

export async function requireOrganization() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    throw new Error('No organization found');
  }

  return organization;
}

// Country-specific withdrawal caps
export const COUNTRY_CAPS: Record<string, number> = {
  Kenya: 60,
  Uganda: 60,
  Tanzania: 30,
  Rwanda: 45,
};

export function getCountryCap(country: string): number {
  return COUNTRY_CAPS[country] ?? 50;
}

export async function enforceCountryCap(
  organizationId: string,
  requestedPercent: number
): Promise<{ allowed: boolean; maxCap: number }> {
  const supabase = await createSupabaseServerClient();

  const { data: org, error } = await supabase
    .from('organizations')
    .select('country')
    .eq('id', organizationId)
    .single();

  if (error || !org) {
    return { allowed: false, maxCap: 50 };
  }

  const maxCap = getCountryCap(org.country);
  const allowed = requestedPercent <= maxCap;

  return { allowed, maxCap };
}
