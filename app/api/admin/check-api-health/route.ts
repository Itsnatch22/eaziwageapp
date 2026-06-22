import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

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

interface APIHealthRow extends HealthCheckResult {
  updated_at?: string | null;
}

// ---------------------------------------------------------------------------
// Supabase service-role client (admin ops only — never exposed to client)
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Auth guard — shared across all methods
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const routeSupabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await routeSupabase.auth.getUser();

  if (authError || !user) return { error: 'Unauthorized', status: 401 as const };

  const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
  if (adminAccess.error || !adminAccess.isAdmin)
    return { error: 'Forbidden', status: 403 as const };

  return { error: null, status: null };
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

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

  const integrations = (data as APIHealthRow[] | null ?? []).map((row) => {
    const status: APIStatus =
      row.status === 'healthy' || row.status === 'degraded' || row.status === 'down'
        ? row.status
        : 'down';

    return {
      name: row.name,
      provider: row.provider ?? 'Unknown',
      status,
      latency_ms: row.latency_ms ?? 0,
      uptime_percent:
        row.uptime_percent ??
        (status === 'healthy' ? 99.9 : status === 'degraded' ? 98 : 0),
      transactions_today: row.transactions_today ?? 0,
      syncs_today: row.syncs_today ?? 0,
      last_check: row.last_check ?? row.updated_at ?? new Date().toISOString(),
    };
  });

  const hasDown = integrations.some((i) => i.status === 'down');
  const hasDegraded = integrations.some((i) => i.status === 'degraded');
  const overall_status: APIStatus = hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy';

  return NextResponse.json(
    {
      overall_status,
      integrations,
      last_updated: new Date().toISOString(),
    },
    { status: 200 }
  );
}

export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const startTime = Date.now();

  const checks = await Promise.allSettled([
    checkSupabaseSelf(),
    checkTwilio(),
    checkVercel(),
    checkCellulant(),
    checkSafaricom(),
    checkRedis(),
    checkResend(),
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

  // Sanitize to exact column set before upsert — no unknown keys
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

  if (upsertError) {
    console.error('[api_health] Upsert failed:', upsertError.message);
    return NextResponse.json({ error: 'Failed to update API health.' }, { status: 500 });
  }

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

function buildResult(
  name: string,
  provider: string,
  status: APIStatus,
  latency_ms: number,
  extras: Partial<Pick<HealthCheckResult, 'transactions_today' | 'syncs_today' | 'uptime_percent' | 'metadata'>> = {}
): HealthCheckResult {
  return {
    name,
    provider,
    status,
    latency_ms,
    uptime_percent: extras.uptime_percent ?? (status === 'healthy' ? 99.9 : status === 'degraded' ? 98 : 0),
    transactions_today: extras.transactions_today ?? 0,
    syncs_today: extras.syncs_today ?? 0,
    last_check: new Date().toISOString(),
    metadata: extras.metadata ?? {},
  };
}

async function checkSupabaseSelf(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('api_health').select('id').limit(1);
    return buildResult('Supabase', 'Supabase', error ? 'degraded' : 'healthy', Date.now() - start);
  } catch {
    return buildResult('Supabase', 'Supabase', 'down', Date.now() - start);
  }
}

async function checkTwilio(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const res = await fetch('https://status.twilio.com/api/v2/summary.json', {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const indicator: string = data.status?.indicator ?? 'none';
    const status: APIStatus =
      indicator === 'none' ? 'healthy' : indicator === 'minor' ? 'degraded' : 'down';
    return buildResult('Twilio SMS', 'Twilio', status, Date.now() - start, {
      metadata: { indicator, incidents: data.incidents?.length ?? 0 },
    });
  } catch {
    return buildResult('Twilio SMS', 'Twilio', 'down', Date.now() - start);
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

async function checkCellulant(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const res = await fetch('https://cellulant-1.freshstatus.io/', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    return buildResult(
      'Cellulant Tingg',
      'Cellulant',
      res.ok ? 'healthy' : 'degraded',
      Date.now() - start
    );
  } catch {
    return buildResult('Cellulant Tingg', 'Cellulant', 'down', Date.now() - start);
  }
}

async function checkSafaricom(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const auth = Buffer.from(
      `${process.env.SAFARICOM_CONSUMER_KEY}:${process.env.SAFARICOM_CONSUMER_SECRET}`
    ).toString('base64');

    const res = await fetch(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(8000),
      }
    );

    return buildResult(
      'M-Pesa Daraja',
      'Safaricom',
      res.ok ? 'healthy' : 'degraded',
      Date.now() - start
    );
  } catch {
    return buildResult('M-Pesa Daraja', 'Safaricom', 'down', Date.now() - start);
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