import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const CURRENCIES = ['KES', 'TZS', 'UGX', 'RWF'] as const;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/USD`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) {
      throw new Error(`Exchange rate API returned HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.result !== 'success') {
      throw new Error(`Exchange rate API error: ${data['error-type'] ?? 'unknown'}`);
    }

    const now = new Date().toISOString();
    const missing: string[] = [];

    const rows = CURRENCIES.flatMap((code) => {
      const rate = data.rates?.[code];
      if (rate == null) {
        missing.push(code);
        return [];
      }
      return [{ currency_code: code, rate_to_usd: rate, updated_at: now }];
    });

    if (rows.length === 0) {
      throw new Error(`No EAC rates found in API response. Missing: ${CURRENCIES.join(', ')}`);
    }

    const { error: upsertError } = await supabaseAdmin
      .from('exchange_rates')
      .upsert(rows, { onConflict: 'currency_code' });

    if (upsertError) throw new Error(`Upsert failed: ${upsertError.message}`);

    console.info('[sync-exchange-rates] Updated', rows.length, 'rates at', now);

    return NextResponse.json({
      ok: true,
      updated: rows.map((r) => ({ currency: r.currency_code, rate: r.rate_to_usd })),
      missing: missing.length > 0 ? missing : undefined,
      synced_at: now,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync-exchange-rates]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
