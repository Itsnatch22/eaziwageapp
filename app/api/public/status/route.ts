import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';

const env = getEnv();

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// api_health.name values are internal vendor names (DusuPay, Africa's Talking,
// Resend, ...) — deliberately not exposed on the public page. Map to generic
// customer-facing categories instead, same reasoning most public status pages
// use ("Payments API" rather than naming the underlying processor).
const PUBLIC_LABELS: Record<string, string> = {
  'Supabase': 'Database & Authentication',
  "Africa's Talking": 'SMS Notifications',
  'DusuPay': 'Payments & Disbursements',
  'Redis': 'Rate Limiting',
  'Resend': 'Email Delivery',
  'Vercel': 'Web Hosting',
};

type PublicStatus = 'operational' | 'degraded' | 'down';

function toPublicStatus(status: string): PublicStatus {
  if (status === 'healthy') return 'operational';
  if (status === 'degraded') return 'degraded';
  return 'down';
}

export async function GET() {
  try {
    const { data: healthRows, error: healthError } = await supabaseAdmin
      .from('api_health')
      .select('name, status, updated_at')
      .in('name', Object.keys(PUBLIC_LABELS));

    if (healthError) throw healthError;

    const services = (healthRows || []).map((row) => ({
      name: PUBLIC_LABELS[row.name] ?? row.name,
      status: toPublicStatus(row.status),
    }));

    const hasDown = services.some((s) => s.status === 'down');
    const hasDegraded = services.some((s) => s.status === 'degraded');
    const overall_status: PublicStatus = hasDown ? 'down' : hasDegraded ? 'degraded' : 'operational';

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: incidentRows } = await supabaseAdmin
      .from('incident_log')
      .select('date, status, affected_services')
      .gte('date', ninetyDaysAgo)
      .order('date', { ascending: false })
      .limit(90);

    const totalDays = incidentRows?.length || 0;
    const healthyDays = (incidentRows || []).filter((r) => r.status === 'healthy').length;
    const uptime_90d_percent = totalDays > 0 ? Math.round((healthyDays / totalDays) * 1000) / 10 : 100;

    // Only surface date/status/a regenerated note for non-healthy days — the
    // stored `note` column is auto-built from the raw internal vendor name
    // ("Automated check detected issues: DusuPay"), which would leak exactly
    // what the PUBLIC_LABELS mapping above is trying to avoid. Re-derive the
    // note here from affected_services through the same mapping instead of
    // ever reading the stored note text.
    const recent_incidents = (incidentRows || [])
      .filter((r) => r.status !== 'healthy')
      .slice(0, 10)
      .map((r) => {
        const publicServiceNames = (r.affected_services || []).map((name: string) => PUBLIC_LABELS[name] ?? 'a monitored service');
        return {
          date: r.date,
          status: toPublicStatus(r.status),
          note: publicServiceNames.length > 0 ? `Affected: ${publicServiceNames.join(', ')}` : null,
        };
      });

    return NextResponse.json({
      overall_status,
      services,
      uptime_90d_percent,
      recent_incidents,
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[public-status] Error:', error);
    // Fail toward "we don't know" rather than a fake "operational" — a status
    // page that always says healthy even when it can't check is worse than none.
    return NextResponse.json(
      { overall_status: 'unknown', services: [], uptime_90d_percent: null, recent_incidents: [], last_updated: new Date().toISOString() },
      { status: 200 },
    );
  }
}
