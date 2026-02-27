import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(_req: NextRequest) {
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

export async function POST(_req: NextRequest) {

  const checks = await Promise.allSettled([
    checkSupabaseSelf(),
    checkTwilio(),
    checkVercel(),
    checkCellulant(),
    checkSafaricom(),
  ]);

  const results = checks
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map(r => r.value);

  // Upsert everything
  const { error } = await supabase
    .from('api_health')
    .upsert(results, { onConflict: 'name' });

  if (error) console.error('Health upsert failed:', error);

  return NextResponse.json({ success: true, checked: results.length }, { status: 200 });
}

// ─── Individual Checks ───────────────────────────────────────────────────────

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