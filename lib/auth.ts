import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { employees } from '@/lib/db/schema';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
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

export async function getCurrentOrganization() {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  // Query user_organizations to get the user's organization
  const result = await db.query.userOrganizations.findFirst({
    where: (userOrgs, { eq }) => eq(userOrgs.user_id, user.id),
    with: {
      organization: true,
    },
  });

  return result?.organization ?? null;
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
  return COUNTRY_CAPS[country] ?? 50; // Default to 50% if country not found
}

export async function enforceCountryCap(
  organizationId: string,
  requestedPercent: number
): Promise<{ allowed: boolean; maxCap: number }> {
  const org = await db.query.organizations.findFirst({
    where: (orgs, { eq }) => eq(orgs.id, organizationId),
  });

  if (!org) {
    return { allowed: false, maxCap: 50 };
  }

  const maxCap = getCountryCap(org.country);
  const allowed = requestedPercent <= maxCap;

  return { allowed, maxCap };
}