import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/env';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { scanQueuedPaymentMethodDocuments } from '@/lib/scanService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const { CRON_SECRET } = getEnv();
    if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const result = await scanQueuedPaymentMethodDocuments(adminSupabase);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error('[internal/scan-payment-method-docs] Error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
