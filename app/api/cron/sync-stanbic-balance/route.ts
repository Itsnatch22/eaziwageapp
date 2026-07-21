import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncStanbicBalance } from '@/lib/stanbic/sync';
import { requestLogger } from '@/lib/logger';
import { isValidCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';

// Keeps admin_wallets.balance fresh independent of whether an admin has
// /admin/wallet open — the client-side auto-sync there only runs while that
// page is mounted, so without this the balance backing the low-balance check
// at topup approval could go stale indefinitely.
function authorize(req: NextRequest): boolean {
  return isValidCronAuth(req.headers.get('authorization'));
}

async function run(req: NextRequest): Promise<NextResponse> {
  const log = requestLogger('cron-sync-stanbic-balance', req);

  let currency = req.nextUrl.searchParams.get('currency');
  if (!currency && req.method === 'POST') {
    try {
      const body = await req.json().catch(() => null) as { currency?: string } | null;
      currency = body?.currency ?? null;
    } catch {
      // Ignore body parsing errors and fallback
    }
  }

  const normalizedCurrency = currency?.toUpperCase();
  let selector = {};
  if (normalizedCurrency === 'KES') {
    selector = { countryCode: 'KE', currency: 'KES' };
  } else if (normalizedCurrency === 'USD') {
    selector = { countryCode: 'KE', currency: 'USD' };
  }

  const result = await syncStanbicBalance(supabaseAdmin, log, selector);

  if (!result.ok) {
    log.error(`Stanbic ${normalizedCurrency ?? 'default'} sync failed`, { status: result.status, error: result.error });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, wallet: result.wallet, currencyAnomaly: result.currencyAnomaly });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run(req);
}
