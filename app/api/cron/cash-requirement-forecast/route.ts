import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

function isAuthorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${expected}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { forecast_date?: string };
    const forecastDate = body.forecast_date || new Date().toISOString().slice(0, 10);

    const { error } = await supabaseAdmin.rpc('calculate_cash_requirement_forecast', {
      p_forecast_date: forecastDate,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, forecast_date: forecastDate });
  } catch (err: unknown) {
    return dbErrorResponse('cron/cash-requirement-forecast', err);
  }
}
