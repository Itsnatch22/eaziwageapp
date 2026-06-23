import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { processApprovedAdvances } from '@/lib/advanceProcessor';

export async function POST(req: NextRequest) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { adminSupabase } = auth;

  try {
    const { processed } = await processApprovedAdvances(adminSupabase, 50);
    return NextResponse.json({ success: true, processed });
  } catch (err: unknown) {
    console.error('process-advances failed', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
