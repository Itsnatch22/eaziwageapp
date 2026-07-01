import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { listPaymentMethods } from '@/lib/paymentMethodsService';

export const runtime = 'nodejs';

// Employers can view (read-only) their employees' payment methods to confirm
// disbursement destinations. They cannot modify them.
export async function GET(
  req: NextRequest,
  { params }: IdRouteContext
) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;

    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify the requesting user is an approved employer
    const { data: employer } = await supabase
      .from('employers')
      .select('id, onboarding_id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!employer) return NextResponse.json({ error: 'Employer not found or not approved' }, { status: 403 });

    // The employer's employees list is sourced from employee_onboarding, so `id` here is
    // an employee_onboarding.id — NOT employees.id (that's a separate UUID minted by the
    // sync_employee_from_onboarding trigger). Verify ownership against employee_onboarding
    // first, using the same employer_id candidates the list route uses.
    const employerIds: string[] = [];
    if (employer.onboarding_id) employerIds.push(employer.onboarding_id);
    if (employer.id && !employerIds.includes(employer.id)) employerIds.push(employer.id);

    const { data: onboarding } = await adminSupabase
      .from('employee_onboarding')
      .select('user_id, country')
      .eq('id', id)
      .in('employer_id', employerIds)
      .maybeSingle();

    if (!onboarding) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Resolve the live employees row — the only stable link between the two tables is user_id.
    const { data: emp } = await adminSupabase
      .from('employees')
      .select('id, country')
      .eq('user_id', onboarding.user_id)
      .maybeSingle();

    // Approved in onboarding but not yet provisioned as a live employee — legitimate empty state.
    if (!emp) return NextResponse.json({ methods: [], country_code: onboarding.country });

    // Reuse the same decrypt+mask path as the employee-side GET so the employer sees
    // "•••• 1234" instead of null — the raw PII columns are always null post-trigger.
    const allMethods = await listPaymentMethods(adminSupabase, emp.id);
    const methods = allMethods
      .filter((m) => m.is_active)
      .sort((a, b) => Number(b.is_default) - Number(a.is_default))
      .map((m) => ({
        id: m.id,
        method_type: m.method_type,
        provider_name: m.provider_name,
        account_name: m.account_name,
        account_number: m.account_number,
        phone_number: m.phone_number,
        country_code: m.country_code,
        is_default: m.is_default,
        is_verified: m.is_verified,
      }));

    return NextResponse.json({ methods, country_code: emp.country ?? onboarding.country });
  } catch (error) {
    console.error('[GET employer/employees/[id]/payment-methods] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
