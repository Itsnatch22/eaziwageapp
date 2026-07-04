import { NextRequest, NextResponse } from 'next/server';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { payoutService } from '@/lib/services/payout-service';
import { FundEmployerSchema } from '@/lib/validations/route-schemas';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { dbErrorResponse } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      req.headers.get('Authorization')?.split(' ')[1] || ''
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Previously checked only system_admins — a legitimate profiles.role-based
    // admin (no system_admins row) got wrongly 403'd on this money-moving route.
    // checkAdminAccess() checks both, matching every other admin route's gate.
    const access = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
    if (!access.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = FundEmployerSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 422 },
      );
    }
    const { employerId, amount, description } = parsed.data;

    const result = await payoutService.fundEmployerWallet(
      employerId,
      amount,
      user.id,
      description
    );

    void supabaseAdmin.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_id: employerId,
      target_type: 'employer',
      action: 'employer_wallet_funded',
      old_value: null,
      new_value: { amount },
      metadata: { description },
    }).then(({ error }) => { if (error) console.error('[audit] employer_wallet_funded:', error); });

    return NextResponse.json({ success: true, result });

  } catch (err: unknown) {
    return dbErrorResponse('admin/payouts/fund-employer', err);
  }
}
