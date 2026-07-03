import { NextResponse } from 'next/server';
import { requireFounder } from '@/lib/server/admin-auth';
import { getConsoleContext } from '@/lib/console/data';
import { logConsoleAccess } from '@/lib/console/audit';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireFounder();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const context = await getConsoleContext();

    void logConsoleAccess({
      adminId: user.id,
      adminEmail: user.email,
      action: 'console_view',
      tablesTouched: [
        'api_health', 'error_logs', 'incident_log',
        'v_console_login_summary', 'v_console_failed_login_summary', 'v_console_trusted_devices_summary',
        'v_console_fraud_summary', 'v_console_fraud_rules_summary',
        'v_console_dusupay_summary', 'v_console_wallet_summary', 'v_console_wallet_tx_summary',
        'v_console_payroll_integrations', 'payout_providers',
        'support_tickets', 'v_console_wiza_summary', 'v_console_notifications_summary',
        'v_console_audit_summary',
      ],
    });

    return NextResponse.json(context);
  } catch (err) {
    console.error('[console/summary] Error:', err);
    return NextResponse.json({ error: 'Failed to load console summary' }, { status: 500 });
  }
}
