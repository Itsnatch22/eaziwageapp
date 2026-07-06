import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess, requireAdmin } from '@/lib/server/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyAdmin } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type APIStatus = 'healthy' | 'degraded' | 'down';

interface HealthCheckResult {
  name: string;
  provider: string;
  status: APIStatus;
  latency_ms: number;
  uptime_percent: number;
  transactions_today: number;
  syncs_today: number;
  last_check: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Supabase service-role client
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Auth — admin session OR CRON_SECRET bearer
// ---------------------------------------------------------------------------

async function requireAdminOrCron(
  req: Request
): Promise<{ error: string; status: 401 | 403 } | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (bearer && process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) return null;

  const routeSupabase = await createRouteHandlerClient();
  const { data: { user }, error: authError } = await routeSupabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
  if (adminAccess.error || !adminAccess.isAdmin) return { error: 'Forbidden', status: 403 };

  return null;
}

// ---------------------------------------------------------------------------
// HEAD
// ---------------------------------------------------------------------------

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// GET — persisted health data (admin only)
// ---------------------------------------------------------------------------

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabase
    .from('api_health')
    .select(
      'name, provider, status, latency_ms, uptime_percent, transactions_today, syncs_today, last_check, updated_at'
    )
    .order('name', { ascending: true });

  if (error) {
    console.error('[api_health] GET failed:', error.message);
    return NextResponse.json({ error: 'Failed to fetch API health.' }, { status: 500 });
  }

  const integrations = (data ?? []).map((row) => {
    const status: APIStatus =
      row.status === 'healthy' || row.status === 'degraded' || row.status === 'down'
        ? row.status
        : 'down';
    return {
      name: row.name,
      provider: row.provider ?? 'Unknown',
      status,
      latency_ms: row.latency_ms ?? 0,
      uptime_percent: row.uptime_percent ?? (status === 'healthy' ? 99.9 : status === 'degraded' ? 98 : 0),
      transactions_today: row.transactions_today ?? 0,
      syncs_today: row.syncs_today ?? 0,
      last_check: row.last_check ?? row.updated_at ?? new Date().toISOString(),
    };
  });

  const hasDown = integrations.some((i) => i.status === 'down');
  const hasDegraded = integrations.some((i) => i.status === 'degraded');
  const overall_status: APIStatus = hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy';

  return NextResponse.json(
    { overall_status, integrations, last_updated: new Date().toISOString() },
    { status: 200 }
  );
}

// ---------------------------------------------------------------------------
// POST — run live checks, persist results, write incident_log
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const authError = await requireAdminOrCron(req);
  if (authError) return NextResponse.json({ error: authError.error }, { status: authError.status });

  const startTime = Date.now();

  const checks = await Promise.allSettled([
    checkSupabaseSelf(),
    checkAfricasTalking(),
    checkDusuPay(),
    checkRedis(),
    checkResend(),
    checkVercel(),
    checkStalledDisbursements(),
    getSystemMetrics(),
  ]);

  const results: HealthCheckResult[] = checks.flatMap((r) =>
    r.status === 'fulfilled' ? [r.value] : []
  );

  const totalCheckTime = Date.now() - startTime;
  const healthyCnt = results.filter((r) => r.status === 'healthy').length;
  const degradedCnt = results.filter((r) => r.status === 'degraded').length;
  const downCnt = results.filter((r) => r.status === 'down').length;

  const systemResult: HealthCheckResult = {
    name: 'System Health',
    provider: 'Internal',
    status: downCnt > 0 ? 'down' : degradedCnt > 0 ? 'degraded' : 'healthy',
    latency_ms: totalCheckTime,
    uptime_percent: 99.9,
    transactions_today: results.length,
    syncs_today: 0,
    last_check: new Date().toISOString(),
    metadata: {
      total_checks: results.length,
      healthy_count: healthyCnt,
      degraded_count: degradedCnt,
      down_count: downCnt,
      check_duration_ms: totalCheckTime,
    },
  };

  const allResults = [...results, systemResult];

  // ── Upsert api_health ──
  const upsertPayload = allResults.map((r) => ({
    name: r.name,
    provider: r.provider,
    status: r.status,
    latency_ms: r.latency_ms,
    uptime_percent: r.uptime_percent,
    transactions_today: r.transactions_today,
    syncs_today: r.syncs_today,
    last_check: r.last_check,
    metadata: r.metadata,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('api_health')
    .upsert(upsertPayload, { onConflict: 'name' });

  if (upsertError) console.error('[api_health] Upsert failed:', upsertError.message);

  // ── Write daily incident_log row ──
  // Worst status across all non-system services wins the day.
  // If the day already has a row, only upgrade severity (healthy → degraded → down), never downgrade.
  const serviceResults = results.filter(
    (r) => r.name !== 'System Health' && r.name !== 'System Metrics'
  );

  const todayStatus: APIStatus =
    serviceResults.some((r) => r.status === 'down')
      ? 'down'
      : serviceResults.some((r) => r.status === 'degraded')
      ? 'degraded'
      : 'healthy';

  const affectedServices = serviceResults
    .filter((r) => r.status !== 'healthy')
    .map((r) => r.name);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Build an auto note only when something is wrong
  const note =
    affectedServices.length > 0
      ? `Automated check detected issues: ${affectedServices.join(', ')}.`
      : null;

  // Fetch existing row to enforce severity-only upgrade
  const { data: existingRow } = await supabase
    .from('incident_log')
    .select('status')
    .eq('date', today)
    .maybeSingle();

  const SEVERITY: Record<APIStatus, number> = { healthy: 0, degraded: 1, down: 2 };

  const existingStatus = existingRow?.status as APIStatus | undefined;
  const shouldUpdate =
    !existingStatus || SEVERITY[todayStatus] > SEVERITY[existingStatus];

  if (shouldUpdate) {
    const { error: logError } = await supabase.from('incident_log').upsert(
      {
        date: today,
        status: todayStatus,
        affected_services: affectedServices,
        ...(note ? { note } : {}),
      },
      { onConflict: 'date' }
    );
    if (logError) console.error('[incident_log] Upsert failed:', logError.message);

    // Previously this route only ever wrote to the DB — the 15-minute
    // GitHub Action just `exit 1`s on a non-200 HTTP response, which triggers
    // GitHub's own passive "workflow failed" email at best. Nobody was
    // actually paged when a real integration went down. Fire only on a
    // severity *upgrade* within the day (first detection, or degraded→down),
    // never on every 15-minute run while a known issue is ongoing — that
    // would just be noise admins learn to ignore.
    if (todayStatus !== 'healthy') {
      void notifyAdmin({
        type: 'system_alert',
        title: todayStatus === 'down' ? '🔴 Service Down' : '🟡 Service Degraded',
        message: `${affectedServices.join(', ') || 'A monitored service'} ${todayStatus === 'down' ? 'is down' : 'is degraded'}. Detected by the automated health check.`,
        metadata: { status: todayStatus, affected_services: affectedServices, checked_at: new Date().toISOString() },
      }).catch((err) => console.error('[check-api-health] notifyAdmin failed:', err));
    }
  }

  // ── Prune rows older than 90 days ──
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  await supabase
    .from('incident_log')
    .delete()
    .lt('date', cutoff.toISOString().split('T')[0]);

  console.log(
    `[Health Check] Done in ${totalCheckTime}ms — Healthy: ${healthyCnt}, Degraded: ${degradedCnt}, Down: ${downCnt}`
  );

  return NextResponse.json(
    {
      success: true,
      checked: allResults.length,
      duration_ms: totalCheckTime,
      summary: systemResult.metadata,
    },
    { status: 200 }
  );
}

// ---------------------------------------------------------------------------
// Shared result builder
// ---------------------------------------------------------------------------

function buildResult(
  name: string,
  provider: string,
  status: APIStatus,
  latency_ms: number,
  extras: Partial<
    Pick<HealthCheckResult, 'transactions_today' | 'syncs_today' | 'uptime_percent' | 'metadata'>
  > = {}
): HealthCheckResult {
  return {
    name,
    provider,
    status,
    latency_ms,
    uptime_percent:
      extras.uptime_percent ??
      (status === 'healthy' ? 99.9 : status === 'degraded' ? 98 : 0),
    transactions_today: extras.transactions_today ?? 0,
    syncs_today: extras.syncs_today ?? 0,
    last_check: new Date().toISOString(),
    metadata: extras.metadata ?? {},
  };
}

// ---------------------------------------------------------------------------
// Service checks
// ---------------------------------------------------------------------------

async function checkSupabaseSelf(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('api_health').select('id').limit(1);
    return buildResult('Supabase', 'Supabase', error ? 'degraded' : 'healthy', Date.now() - start);
  } catch {
    return buildResult('Supabase', 'Supabase', 'down', Date.now() - start);
  }
}

async function checkAfricasTalking(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const res = await fetch('https://status.africastalking.com/api/v2/summary.json', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return buildResult("Africa's Talking", "Africa's Talking", 'degraded', Date.now() - start, {
        metadata: { http_status: res.status },
      });
    }
    const data = await res.json();
    const indicator: string = data.status?.indicator ?? 'none';
    const status: APIStatus =
      indicator === 'none' ? 'healthy' : indicator === 'minor' ? 'degraded' : 'down';
    const components: Array<{ name: string; status: string }> = (data.components ?? []).map(
      (c: { name: string; status: string }) => ({ name: c.name, status: c.status })
    );
    return buildResult("Africa's Talking", "Africa's Talking", status, Date.now() - start, {
      metadata: {
        indicator,
        description: data.status?.description ?? '',
        active_incidents: data.incidents?.length ?? 0,
        components,
      },
    });
  } catch {
    return buildResult("Africa's Talking", "Africa's Talking", 'down', Date.now() - start);
  }
}

async function checkDusuPay(): Promise<HealthCheckResult> {
  const start = Date.now();
  const publicKey = process.env.DUSUPAY_PUBLIC_KEY;
  if (!publicKey) {
    console.error('[DusuPay] DUSUPAY_PUBLIC_KEY not set');
    return buildResult('DusuPay', 'DusuPay', 'down', 0, {
      metadata: { error: 'Missing DUSUPAY_PUBLIC_KEY' },
    });
  }
  try {
    const res = await fetch(
      'https://sandboxapi.dusupay.com/data/payment-providers?currency=UGX&transaction_type=COLLECTION',
      {
        headers: {
          Accept: 'application/json',
          'x-api-version': '1',
          'public-key': publicKey,
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await res.json();
    if (!res.ok || data.code !== 200) {
      return buildResult('DusuPay', 'DusuPay', 'degraded', Date.now() - start, {
        metadata: { http_status: res.status, api_code: data.code, message: data.message },
      });
    }
    return buildResult('DusuPay', 'DusuPay', 'healthy', Date.now() - start, {
      metadata: { environment: 'sandbox', active_providers: data.data?.length ?? 0 },
    });
  } catch {
    return buildResult('DusuPay', 'DusuPay', 'down', Date.now() - start);
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    await redis.ping();
    return buildResult('Redis Cache', 'Upstash', 'healthy', Date.now() - start);
  } catch {
    return buildResult('Redis Cache', 'Upstash', 'down', Date.now() - start);
  }
}

async function checkResend(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.domains.list();
    return buildResult('Resend Email', 'Resend', 'healthy', Date.now() - start);
  } catch {
    return buildResult('Resend Email', 'Resend', 'down', Date.now() - start);
  }
}

async function checkVercel(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const res = await fetch('https://www.vercel-status.com/api/v2/status.json', {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const indicator: string = data.status?.indicator ?? 'none';
    const status: APIStatus =
      indicator === 'none' ? 'healthy' : indicator === 'minor' ? 'degraded' : 'down';
    return buildResult('Vercel Hosting', 'Vercel', status, Date.now() - start, {
      metadata: { indicator },
    });
  } catch {
    return buildResult('Vercel Hosting', 'Vercel', 'down', Date.now() - start);
  }
}

// Every other check here only asks whether a *vendor* is reachable — none of
// them ask whether EaziWage's own disbursement pipeline is actually moving
// money. DusuPay, Redis, Resend can all report healthy while a bug in
// payout-service.ts, a missed webhook, or a silently-failing cron leaves
// advances stuck in 'processing' forever. updated_at on advances is
// DB-trigger-maintained (trg_advances_updated_at fires on every UPDATE), so
// "processing and untouched for a while" reliably means "should have moved
// by now and didn't" rather than a false positive from a fast-moving row.
const STALLED_PROCESSING_MINUTES = 30;

async function checkStalledDisbursements(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const cutoff = new Date(Date.now() - STALLED_PROCESSING_MINUTES * 60 * 1000).toISOString();

    const { data: stalled, error } = await supabase
      .from('advances')
      .select('id, updated_at')
      .eq('status', 'processing')
      .lt('updated_at', cutoff)
      .limit(20);

    if (error) {
      return buildResult('Disbursement Pipeline', 'Internal', 'degraded', Date.now() - start, {
        metadata: { error: error.message },
      });
    }

    const count = stalled?.length ?? 0;
    return buildResult(
      'Disbursement Pipeline',
      'Internal',
      count > 0 ? 'down' : 'healthy',
      Date.now() - start,
      {
        metadata: {
          stalled_count: count,
          threshold_minutes: STALLED_PROCESSING_MINUTES,
          stalled_advance_ids: (stalled ?? []).map((r) => r.id),
        },
      }
    );
  } catch (err: unknown) {
    return buildResult('Disbursement Pipeline', 'Internal', 'degraded', Date.now() - start, {
      metadata: { error: err instanceof Error ? err.message : 'Unknown error' },
    });
  }
}

async function getSystemMetrics(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    return buildResult('System Metrics', 'Node.js', 'healthy', Date.now() - start, {
      metadata: {
        memory_usage_mb: Math.round(mem.heapUsed / 1024 / 1024),
        memory_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        cpu_user: cpu.user,
        cpu_system: cpu.system,
        uptime_seconds: Math.round(process.uptime()),
      },
    });
  } catch {
    return buildResult('System Metrics', 'Node.js', 'down', Date.now() - start);
  }
}