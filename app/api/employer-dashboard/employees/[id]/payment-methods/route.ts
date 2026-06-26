import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { checkAdminRateLimit } from '@/lib/rate-limit';

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
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!employer) return NextResponse.json({ error: 'Employer not found or not approved' }, { status: 403 });

    // Verify the employee belongs to this employer
    const { data: emp } = await adminSupabase
      .from('employees')
      .select('id, country')
      .eq('id', id)
      .eq('employer_id', employer.id)
      .maybeSingle();

    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const { data: methods, error } = await adminSupabase
      .from('payment_methods')
      .select('id, method_type, provider_name, account_name, account_number, phone_number, country_code, is_default, is_verified, is_active, created_at')
      .eq('employee_id', emp.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ methods: methods ?? [], country_code: emp.country });
  } catch (error) {
    console.error('[GET employer/employees/[id]/payment-methods] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
