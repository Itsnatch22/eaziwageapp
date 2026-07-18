import { NextRequest, NextResponse } from 'next/server';
import { adminApiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';

// :id is the employer_onboarding id (matches /api/admin/employers/[id] and the
// bank route) — resolve to the live employers.id before touching employer_wallets,
// which is keyed by the live id, not the onboarding one.
export async function GET(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  const { id } = await params;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(adminApiLimiter, `admin-employer-wallet:${ip}`);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase } = auth;

  const { data: liveEmployer, error: liveEmployerError } = await adminSupabase
    .from('employers')
    .select('id, company_name')
    .eq('onboarding_id', id)
    .maybeSingle();

  if (liveEmployerError || !liveEmployer) {
    return NextResponse.json(
      { error: 'Employer not found.', code: 'NOT_FOUND' },
      { status: 404, headers: rateResult.headers }
    );
  }

  const { data: wallet, error: walletError } = await adminSupabase
    .from('employer_wallets')
    .select('id, employer_id, total_advanced, outstanding_liability, total_repaid, currency, reserved_amount, updated_at')
    .eq('employer_id', liveEmployer.id)
    .maybeSingle();

  if (walletError) {
    return NextResponse.json(
      { error: 'Failed to load wallet.', code: 'SERVER_ERROR' },
      { status: 500, headers: rateResult.headers }
    );
  }

  const { data: transactions, error: txError } = wallet
    ? await adminSupabase
        .from('wallet_transactions')
        .select('id, amount, type, status, description, reference, created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(25)
    : { data: [], error: null };

  if (txError) {
    return NextResponse.json(
      { error: 'Failed to load transactions.', code: 'SERVER_ERROR' },
      { status: 500, headers: rateResult.headers }
    );
  }

  return NextResponse.json(
    {
      live_employer_id: liveEmployer.id,
      company_name: liveEmployer.company_name,
      wallet: wallet ?? null,
      transactions: transactions ?? [],
    },
    { status: 200, headers: rateResult.headers }
  );
}
