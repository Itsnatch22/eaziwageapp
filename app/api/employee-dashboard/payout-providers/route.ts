import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { normalizeCountryCode } from '@/lib/utils';

export const runtime = 'nodejs';

// Feeds the "Add Payment Method" provider dropdown with the same enabled,
// country-scoped provider list payouts are actually validated against —
// previously that screen was a free-text input with no tie to payout_providers
// at all, so nothing stopped an employee from saving a provider name that
// doesn't correspond to anything DusuPay actually supports.
export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  const { data: employee, error: employeeError } = await adminSupabase
    .from('employees')
    .select('country')
    .eq('user_id', user.id)
    .maybeSingle();

  if (employeeError) {
    console.error('[payout-providers] employee lookup failed:', employeeError);
    return NextResponse.json({ error: 'Failed to load payout providers' }, { status: 500 });
  }
  if (!employee) {
    return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
  }

  const countryCode = normalizeCountryCode(employee.country);
  if (!countryCode) {
    console.error('[payout-providers] unsupported employee country:', employee.country);
    return NextResponse.json({ error: 'Employee country is not supported' }, { status: 422 });
  }

  const { data: providers, error: providersError } = await adminSupabase
    .from('payout_providers')
    .select('id, provider_key, provider_name, method_type, country_code')
    .eq('country_code', countryCode)
    .eq('enabled', true)
    .order('provider_name');

  if (providersError) {
    console.error('[payout-providers] query failed:', providersError);
    return NextResponse.json({ error: 'Failed to load payout providers' }, { status: 500 });
  }

  return NextResponse.json({ providers: providers ?? [], country_code: countryCode });
}
