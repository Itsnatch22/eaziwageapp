// Server-side only — the Vercel token never reaches the client.

interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  created: number;
  state: string;
  target?: string | null;
}

interface VercelLogEvent {
  id: string;
  timestamp: number;
  level?: string;
  message?: string;
  source?: string;
  statusCode?: number;
}

async function vercelFetch(path: string): Promise<unknown> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) throw new Error('VERCEL_API_TOKEN is not configured');

  const teamQuery = process.env.VERCEL_TEAM_ID ? `${path.includes('?') ? '&' : '?'}teamId=${process.env.VERCEL_TEAM_ID}` : '';
  const res = await fetch(`https://api.vercel.com${path}${teamQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vercel API error (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

export async function getLatestProductionDeployment(): Promise<VercelDeployment | null> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) throw new Error('VERCEL_PROJECT_ID is not configured');

  const data = (await vercelFetch(`/v6/deployments?projectId=${projectId}&target=production&limit=1`)) as {
    deployments?: VercelDeployment[];
  };
  return data.deployments?.[0] ?? null;
}

/**
 * Summarizes recent production runtime logs — error rate and top error
 * signatures. Raw log lines are returned too, for drill-down, but the AI
 * summary layer only ever receives the aggregated counts, not raw lines.
 */
export async function getProductionLogSummary() {
  const deployment = await getLatestProductionDeployment();
  if (!deployment) {
    return { deployment: null, errorCount: 0, topSignatures: [] as { message: string; count: number }[], rawSample: [] as VercelLogEvent[] };
  }

  const data = (await vercelFetch(`/v3/deployments/${deployment.uid}/events?limit=500`)) as VercelLogEvent[] | { events?: VercelLogEvent[] };
  const events = Array.isArray(data) ? data : data.events ?? [];

  const errorEvents = events.filter((e) => e.level === 'error' || (e.statusCode ?? 0) >= 500);

  const signatureCounts = new Map<string, number>();
  for (const e of errorEvents) {
    const key = (e.message ?? 'unknown').slice(0, 200);
    signatureCounts.set(key, (signatureCounts.get(key) ?? 0) + 1);
  }
  const topSignatures = Array.from(signatureCounts.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    deployment: { uid: deployment.uid, url: deployment.url, created: deployment.created, state: deployment.state },
    errorCount: errorEvents.length,
    topSignatures,
    rawSample: errorEvents.slice(0, 20),
  };
}
