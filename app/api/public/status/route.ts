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
  'Redis Cache': 'Rate Limiting',
  'Resend Email': 'Email Delivery',
  'Vercel Hosting': 'Web Hosting',
  'Disbursement Pipeline': 'Transaction Processing',
};

type PublicStatus = 'operational' | 'degraded' | 'down';

function toPublicStatus(status: string): PublicStatus {
  if (status === 'healthy') return 'operational';
  if (status === 'degraded') return 'degraded';
  return 'down';
}

// GitHub Actions' every-5-minute cron for sync-health.yml doesn't reliably
// fire that often — observed gaps of 55min to 3+ hours between runs despite
// every run succeeding when it does trigger, a known limitation of GitHub's
// shared-runner scheduler for high-frequency schedules. Vercel Cron isn't a
// fix either on the Hobby plan (throttled to once/day regardless of the
// configured schedule). Rather than let a real visitor see stale data,
// trigger a live check inline whenever the cached result is older than this
// — the background cron becomes a best-effort warm cache; this is what
// actually guarantees freshness for anyone looking at the page.
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  try {
    const { data: healthRows, error: healthError } = await supabaseAdmin
      .from('api_health')
      .select('name, status, updated_at')
      .in('name', Object.keys(PUBLIC_LABELS));

    if (healthError) throw healthError;

    let rows = healthRows ?? [];

    const mostRecentUpdate = rows.reduce((latest, r) => {
      const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
      return t > latest ? t : latest;
    }, 0);
    const isStale = rows.length === 0 || Date.now() - mostRecentUpdate > STALE_THRESHOLD_MS;

    if (isStale && process.env.CRON_SECRET) {
      try {
        const origin = new URL(req.url).origin;
        const refreshRes = await fetch(`${origin}/api/admin/check-api-health`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
          signal: AbortSignal.timeout(15000),
        });
        if (refreshRes.ok) {
          const { data: freshRows } = await supabaseAdmin
            .from('api_health')
            .select('name, status, updated_at')
            .in('name', Object.keys(PUBLIC_LABELS));
          if (freshRows) rows = freshRows;
        }
      } catch (refreshErr) {
        // Non-fatal — fall back to whatever cached data we have rather than
        // failing the whole public status page over a refresh hiccup.
        console.error('[public-status] Inline refresh failed:', refreshErr);
      }
    }

    const services = rows.map((row) => ({
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
