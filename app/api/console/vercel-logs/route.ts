import { NextResponse } from 'next/server';
import { requireFounder } from '@/lib/server/admin-auth';
import { getProductionLogSummary } from '@/lib/console/vercel-logs';
import { logConsoleAccess } from '@/lib/console/audit';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireFounder();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const summary = await getProductionLogSummary();

    void logConsoleAccess({
      adminId: user.id,
      adminEmail: user.email,
      action: 'console_view',
      tablesTouched: ['vercel:production-deployment-events'],
    });

    return NextResponse.json(summary);
  } catch (err) {
    console.error('[console/vercel-logs] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load Vercel logs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
