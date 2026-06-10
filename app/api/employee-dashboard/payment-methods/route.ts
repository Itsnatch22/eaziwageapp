import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import {
  createPaymentMethod,
  listPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
} from '@/lib/paymentMethodsService';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const PaymentMethodCreateSchema = z.object({
  country_code: z.string().min(2).max(2),
  method_type: z.enum(['mobile_money', 'bank_account']),
  provider_name: z.string().min(1),
  account_name: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  is_default: z.boolean().optional(),
});

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const methods = await listPaymentMethods(adminSupabase, user.id);
    return NextResponse.json({ methods });
  } catch (err) {
    console.error('Payment methods GET error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // support actions: create, set_default
    if (body.action === 'set_default') {
      const id = body.id as string | undefined;
      if (!id) return NextResponse.json({ error: 'Missing id for set_default' }, { status: 400 });
      const updated = await setDefaultPaymentMethod(adminSupabase, user.id, id);
      return NextResponse.json({ success: true, method: updated });
    }

    // default to create
    const parse = PaymentMethodCreateSchema.safeParse(body);
    if (!parse.success) return NextResponse.json({ error: 'Invalid payload', details: parse.error.flatten() }, { status: 400 });

    // basic cross-field validation
    const payload = parse.data;
    if (payload.method_type === 'mobile_money' && !payload.phone_number) {
      return NextResponse.json({ error: 'phone_number is required for mobile_money' }, { status: 400 });
    }
    if (payload.method_type === 'bank_account' && !payload.account_number) {
      return NextResponse.json({ error: 'account_number is required for bank_account' }, { status: 400 });
    }

    const created = await createPaymentMethod(adminSupabase, user.id, payload);
    return NextResponse.json({ success: true, method: created });
  } catch (err) {
    console.error('Payment methods POST error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const methodId = searchParams.get('id');
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!methodId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await deletePaymentMethod(adminSupabase, user.id, methodId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Payment methods DELETE error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
