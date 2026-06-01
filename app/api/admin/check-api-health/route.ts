import { createClient } from '@supabase/supabase-js';
import pusherServer from '@/lib/pusher-server';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type APIStatus = 'healthy' | 'degraded' | 'down';

interface APIHealthRow {
  name: string;
  provider?: string | null;
  status?: APIStatus | null;
  latency_ms?: number | null;
  uptime_percent?: number | null;
  transactions_today?: number | null;
  syncs_today?: number | null;
  last_check?: string | null;
  updated_at?: string | null;
}

export async function GET() {
  const { data, error } = await supabase
    .from('api_health')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Health fetch failed:', error);
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
  const startTime = Date.now();

  const checks = await Promise.allSettled([
    checkSupabaseSelf(),
    checkTwilio(),
    checkVercel(),
    checkCellulant(),
    checkSafaricom(),
    checkRedis(),
    checkResend(),
    checkPusher(),
    getSystemMetrics(),
  ]);

  const results = checks.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const totalCheckTime = Date.now() - startTime;

  const systemResult = {
    name: 'System Health',
    provider: 'Internal',
    status: results.every(r => r.status === 'healthy') ? 'healthy' : 
           results.some(r => r.status === 'down') ? 'down' : 'degraded',
    latency_ms: totalCheckTime,
    uptime_percent: 99.9,
    transactions_today: results.length,
    metadata: {
      total_checks: results.length,
      healthy_count: results.filter(r => r.status === 'healthy').length,
      degraded_count: results.filter(r => r.status === 'degraded').length,
      down_count: results.filter(r => r.status === 'down').length,
      check_duration_ms: totalCheckTime
    }
  };

  const allResults = [...results, systemResult];

  const { error } = await supabase
    .from('api_health')
    .upsert(allResults, { onConflict: 'name' });

  if (error) console.error('Health upsert failed:', error);

  console.log(`[Health Check] Completed in ${totalCheckTime}ms - Healthy: ${systemResult.metadata.healthy_count}, Degraded: ${systemResult.metadata.degraded_count}, Down: ${systemResult.metadata.down_count}`);

  return NextResponse.json({ 
    success: true, 
    checked: allResults.length,
    duration_ms: totalCheckTime,
    summary: systemResult.metadata
  }, { status: 200 });
}


async function checkSupabaseSelf() {
  const start = Date.now();
  try {
    const { error } = await supabase.from('api_health').select('id').limit(1);
    const latency = Date.now() - start;
    return {
      name: 'Supabase',
      provider: 'Supabase',
      status: error ? 'degraded' : 'healthy' as const,
      latency_ms: latency,
      transactions_today: 0,
      metadata: {},
    };
  } catch {
    return { name: 'Supabase', provider: 'Supabase', status: 'down' as const, latency_ms: Date.now() - start };
  }
}

async function checkTwilio() {
  const start = Date.now();
  try {
    const res = await fetch('https://status.twilio.com/api/v2/summary.json', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const indicator = data.status?.indicator || 'none';
    return {
      name: 'Twilio SMS',
      provider: 'Twilio',
      status: indicator === 'none' ? 'healthy' : indicator === 'minor' ? 'degraded' : 'down',
      latency_ms: Date.now() - start,
      metadata: { indicator, incidents: data.incidents?.length ?? 0 },
    };
  } catch {
    return { name: 'Twilio SMS', provider: 'Twilio', status: 'down' as const, latency_ms: Date.now() - start };
  }
}

async function checkVercel() {
  const start = Date.now();
  try {
    const res = await fetch('https://www.vercel-status.com/api/v2/status.json', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const indicator = data.status?.indicator || 'none';
    return {
      name: 'Vercel Hosting',
      provider: 'Vercel',
      status: indicator === 'none' ? 'healthy' : indicator === 'minor' ? 'degraded' : 'down',
      latency_ms: Date.now() - start,
    };
  } catch {
    return { name: 'Vercel Hosting', provider: 'Vercel', status: 'down' as const, latency_ms: Date.now() - start };
  }
}
async function checkCellulant() {
  const start = Date.now();
  try {
    const res = await fetch('https://cellulant-1.freshstatus.io/', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return {
      name: 'Cellulant Tingg',
      provider: 'Cellulant',
      status: res.ok ? 'healthy' : 'degraded',
      latency_ms: Date.now() - start,
    };
  } catch {
    return { name: 'Cellulant Tingg', provider: 'Cellulant', status: 'down' as const, latency_ms: Date.now() - start };
  }
}

async function checkSafaricom() {
  const start = Date.now();
  try {
    const auth = Buffer.from(
      `${process.env.SAFARICOM_CONSUMER_KEY}:${process.env.SAFARICOM_CONSUMER_SECRET}`
    ).toString('base64');

    const res = await fetch(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(8000) }
    );

    return {
      name: 'M-Pesa Daraja',
      provider: 'Safaricom',
      status: res.ok ? 'healthy' : 'degraded',
      latency_ms: Date.now() - start,
    };
  } catch {
    return { name: 'M-Pesa Daraja', provider: 'Safaricom', status: 'down' as const, latency_ms: Date.now() - start };
  }
}

async function checkRedis() {
  const start = Date.now();
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    
    await redis.ping();
    return {
      name: 'Redis Cache',
      provider: 'Upstash',
      status: 'healthy' as const,
      latency_ms: Date.now() - start,
    };
  } catch {
    return { name: 'Redis Cache', provider: 'Upstash', status: 'down' as const, latency_ms: Date.now() - start };
  }
}

async function checkResend() {
  const start = Date.now();
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY!);
    
    await resend.domains.list();
    return {
      name: 'Resend Email',
      provider: 'Resend',
      status: 'healthy' as const,
      latency_ms: Date.now() - start,
    };
  } catch {
    return { name: 'Resend Email', provider: 'Resend', status: 'down' as const, latency_ms: Date.now() - start };
  }
}

async function checkPusher() {
  const start = Date.now();
  try {
    const auth = pusherServer.authenticate('test-channel', 'test-0001:12345');
    const latency = Date.now() - start;
    return {
      name: 'Pusher WebSocket',
      provider: 'Pusher',
      status: !!auth ? 'healthy' as const : 'degraded' as const,
      latency_ms: latency,
    };
  } catch {
    return {
      name: 'Pusher WebSocket',
      provider: 'Pusher',
      status: 'down' as const,
      latency_ms: Date.now() - start,
    };
  }
}

async function getSystemMetrics() {
  const start = Date.now();
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      name: 'System Metrics',
      provider: 'Node.js',
      status: 'healthy' as const,
      latency_ms: Date.now() - start,
      metadata: {
        memory_usage_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        memory_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
        cpu_user: cpuUsage.user,
        cpu_system: cpuUsage.system,
        uptime_seconds: Math.round(process.uptime()),
      }
    };
  } catch {
    return { name: 'System Metrics', provider: 'Node.js', status: 'down' as const, latency_ms: Date.now() - start };
  }
}
