import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyAdmin } from '@/lib/notifications';
import { dbErrorResponse } from '@/lib/api-errors';
import { isValidCronAuth } from '@/lib/cron-auth';

async function run(): Promise<NextResponse> {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from('employer_onboarding')
      .select('id, user_id, company_name, deleted_at, employers!employers_onboarding_id_fkey(id, is_defaulted, default_amount)')
      .lt('deleted_at', cutoff)
      .not('deleted_at', 'is', null);

    if (fetchError) return dbErrorResponse('cron/purge-terminated-employers', fetchError);
    if (!candidates?.length) return NextResponse.json({ purged: 0, blocked: 0 });

    let purged = 0;
    const blocked: string[] = [];

    for (const row of candidates) {
      const employer = Array.isArray(row.employers) ? row.employers[0] : row.employers;
      if (!employer) continue;

      const { data: wallet, error: walletError } = await supabaseAdmin
        .from('employer_wallets')
        .select('outstanding_liability, reserved_amount')
        .eq('employer_id', employer.id)
        .maybeSingle();

      if (walletError) return dbErrorResponse('cron/purge-terminated-employers', walletError);

      const hasLiability = (wallet?.outstanding_liability ?? 0) > 0 || (wallet?.reserved_amount ?? 0) > 0;
      const isDefaulted = employer.is_defaulted || (employer.default_amount ?? 0) > 0;

      if (hasLiability || isDefaulted) {
        blocked.push(row.id);
        continue;
      }

      const { error: purgeError } = await supabaseAdmin.rpc('purge_employer_account_data', {
        p_onboarding_id: row.id,
      });
      if (purgeError) return dbErrorResponse('cron/purge-terminated-employers', purgeError);
      purged++;
    }

    if (blocked.length > 0) {
      await notifyAdmin({
        type: 'termination_purge_blocked',
        title: 'Terminated employer cleanup blocked',
        message: `${blocked.length} terminated employer(s) past the 30-day window still have outstanding liability or default status and were NOT purged. Manual review needed.`,
        metadata: { onboarding_ids: blocked },
      });
    }

    return NextResponse.json({ purged, blocked: blocked.length });
  } catch (err) {
    console.error('[cron/purge-terminated-employers]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isValidCronAuth(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return run();
}
