import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { listPaymentMethods, setDefaultPaymentMethod, createPaymentMethod } from '@/lib/paymentMethodsService';
import { z } from 'zod';

export const runtime = 'nodejs';

const AddSchema = z.object({
  country_code:  z.string().min(2).max(2),
  method_type:   z.enum(['mobile_money', 'bank_account']),
  provider_name: z.string().min(1),
  account_name:  z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  phone_number:  z.string().optional().nullable(),
  is_default:    z.boolean().optional(),
});

async function resolveEmployeeRow(adminSupabase: ReturnType<typeof import('@/lib/supabaseAdmin').createAdminClient>, id: string) {
  // id is employees.id (from admin context)
  return adminSupabase.from('employees').select('id, user_id, country').eq('id', id).maybeSingle();
}

export async function GET(
  req: NextRequest,
  { params }: IdRouteContext
) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { adminSupabase } = auth;

    const { data: emp } = await resolveEmployeeRow(adminSupabase, id);
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const methods = await listPaymentMethods(adminSupabase, emp.id);
    return NextResponse.json({ methods, country_code: emp.country });
  } catch (error) {
    console.error('[GET /api/admin/employees/[id]/payment-methods] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: IdRouteContext
) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const { data: emp } = await resolveEmployeeRow(adminSupabase, id);
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const body = await req.json();

    if (body.action === 'set_default') {
      const methodId = body.id as string | undefined;
      if (!methodId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      // Verify the payment method belongs to this employee
      const { data: pm } = await adminSupabase
        .from('payment_methods')
        .select('id, employee_id')
        .eq('id', methodId)
        .maybeSingle();
      if (!pm || pm.employee_id !== emp.id) {
        return NextResponse.json({ error: 'Payment method not found for this employee' }, { status: 404 });
      }

      const updated = await setDefaultPaymentMethod(adminSupabase, emp.id, methodId);

      void adminSupabase.from('system_audit_logs').insert({
        admin_id:    user.id,
        admin_name:  user.email,
        target_id:   id,
        target_type: 'employee',
        action:      'set_default_payment_method',
        new_value:   { payment_method_id: methodId },
        created_at:  new Date().toISOString(),
      });

      return NextResponse.json({ success: true, method: updated });
    }

    // Add a new payment method on behalf of the employee
    const parse = AddSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parse.error.flatten() }, { status: 400 });
    }

    const payload = parse.data;
    if (payload.method_type === 'mobile_money' && !payload.phone_number) {
      return NextResponse.json({ error: 'phone_number required for mobile_money' }, { status: 400 });
    }
    if (payload.method_type === 'bank_account' && !payload.account_number) {
      return NextResponse.json({ error: 'account_number required for bank_account' }, { status: 400 });
    }

    // Admin-added payment methods are pre-verified (no OTP needed)
    const created = await createPaymentMethod(adminSupabase, emp.id, { ...payload, is_default: payload.is_default ?? false });

    // Mark as verified immediately since admin added it
    await adminSupabase
      .from('payment_methods')
      .update({ is_verified: true })
      .eq('id', (created as { id: string }).id);

    void adminSupabase.from('system_audit_logs').insert({
      admin_id:    user.id,
      admin_name:  user.email,
      target_id:   id,
      target_type: 'employee',
      action:      'add_payment_method',
      new_value:   { method_type: payload.method_type, provider_name: payload.provider_name },
      created_at:  new Date().toISOString(),
    });

    return NextResponse.json({ success: true, method: created });
  } catch (error) {
    console.error('[POST /api/admin/employees/[id]/payment-methods] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
