import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

// ─── Types ────────────────────────────────────────────────────────────────────

type APIStatus = 'healthy' | 'degraded' | 'down';

interface APIIntegration {
  name:               string;
  provider:           string;
  status:             APIStatus;
  latency_ms:         number;
  uptime_percent:     number;
  transactions_today?: number;
  syncs_today?:       number;
  last_check:         string;
}

// ─── Helper: Check API Health ─────────────────────────────────────────────────

async function checkAPIHealth(name: string, endpoint: string): Promise<Omit<APIIntegration, 'name' | 'provider'>> {
  // In production, this would ping the actual API endpoint
  // For now, return mock data with simulated checks
  const startTime = Date.now();
  
  try {
    // Simulate API call (replace with actual health check)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
    
    const latency = Date.now() - startTime;
    
    // Determine status based on latency
    const status: APIStatus = 
      latency < 150 ? 'healthy' :
      latency < 300 ? 'degraded' : 'down';

    return {
      status,
      latency_ms:         latency,
      uptime_percent:     99.5 + Math.random() * 0.5, // Mock uptime
      transactions_today: Math.floor(Math.random() * 1000 + 500),
      last_check:         new Date().toISOString(),
    };
  } catch (error) {
    return {
      status:             'down',
      latency_ms:         0,
      uptime_percent:     0,
      transactions_today: 0,
      last_check:         new Date().toISOString(),
    };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Rate-limit ──────────────────────────────────────────────────────────
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-api-health:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  // ── 2. Auth check (admin-only) ────────────────────────────────────────────
  // TODO: Replace with actual admin auth middleware/session check

  try {
    // ── 3. Check all integrations ─────────────────────────────────────────────
    const integrations: APIIntegration[] = [
      {
        name:     'M-Pesa Integration',
        provider: 'Safaricom',
        ...(await checkAPIHealth('mpesa', 'https://api.safaricom.co.ke/health')),
      },
      {
        name:     'Airtel Money',
        provider: 'Airtel Kenya',
        ...(await checkAPIHealth('airtel', 'https://api.airtel.co.ke/health')),
      },
      {
        name:     'Bank Integration',
        provider: 'Multiple Banks',
        ...(await checkAPIHealth('bank', 'https://api.banks.co.ke/health')),
      },
      {
        name:     'Payroll Sync',
        provider: 'Internal Service',
        syncs_today: Math.floor(Math.random() * 50 + 20),
        ...(await checkAPIHealth('payroll', 'https://payroll.internal/health')),
      },
    ];

    // ── 4. Determine overall status ───────────────────────────────────────────
    const hasDown     = integrations.some(i => i.status === 'down');
    const hasDegraded = integrations.some(i => i.status === 'degraded');

    const overallStatus: APIStatus = 
      hasDown     ? 'down' :
      hasDegraded ? 'degraded' : 'healthy';

    // ── 5. Return response ────────────────────────────────────────────────────
    return NextResponse.json(
      {
        overall_status: overallStatus,
        integrations,
        last_updated:   new Date().toISOString(),
      },
      { status: 200, headers: rateResult.headers },
    );
  } catch (error) {
    console.error('[GET /api/admin/api-health] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API health.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}