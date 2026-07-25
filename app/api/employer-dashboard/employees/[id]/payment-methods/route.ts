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

    // The employer's employees list historically used employee_onboarding IDs, but
    // some callers (current frontend) pass the live employees.id. Accept both forms:
    // 1) Try to resolve employee_onboarding by id (ownership check) and map to employees via user_id
    // 2) Fallback to resolving employees by id and verify employer ownership
    const employerIds: string[] = [];
    if (employer.onboarding_id) employerIds.push(employer.onboarding_id);
    if (employer.id && !employerIds.includes(employer.id)) employerIds.push(employer.id);

    // Attempt onboarding lookup first (old behavior)
    const { data: onboarding } = await adminSupabase
      .from('employee_onboarding')
      .select('user_id, country')
      .eq('id', id)
      .in('employer_id', employerIds)
      .maybeSingle();

    let emp: { id: string; country: string | null } | null = null;
    if (onboarding) {
      const { data: empRow } = await adminSupabase
        .from('employees')
        .select('id, country')
        .eq('user_id', onboarding.user_id)
        .maybeSingle();

      // Approved in onboarding but not yet provisioned as a live employee — legitimate empty state.
      if (!empRow) return NextResponse.json({ methods: [], country_code: onboarding.country });
      emp = { id: empRow.id, country: empRow.country ?? onboarding.country };
    } else {
      // Fallback: try resolving as a live employees.id (caller passed employees.id)
      const { data: empById } = await adminSupabase
        .from('employees')
        .select('id, country, employer_id')
        .eq('id', id)
        .maybeSingle();

      if (!empById) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

      // Verify ownership: employee.employer_id should match the requesting employer.id (or onboarding_id)
      const empEmployerId = empById.employer_id;
      if (empEmployerId !== employer.id && empEmployerId !== employer.onboarding_id) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      emp = { id: empById.id, country: empById.country ?? null };
    }

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

    return NextResponse.json({ methods, country_code: emp.country ?? onboarding?.country ?? null });
  } catch (error) {
    console.error('[GET employer/employees/[id]/payment-methods] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
