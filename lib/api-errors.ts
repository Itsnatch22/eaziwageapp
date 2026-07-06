import { NextResponse } from 'next/server';

// Postgres error code 53300 = too_many_connections; Supavisor/pgbouncer surface
// the same condition as a plain string ("too many connections", "max client
// connections reached", "remaining connection slots are reserved"). This
// project's free-tier Supabase instance has a hard max_connections=60 ceiling —
// previously a pool-exhaustion error fell through to a generic 500 identical to
// an actual bug, giving users no signal that retrying shortly would likely work.
export function isConnectionExhaustionError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  if (code === '53300') return true;

  const message = (err as { message?: string } | null)?.message?.toLowerCase() ?? '';
  return (
    message.includes('too many connections') ||
    message.includes('max client connections') ||
    message.includes('remaining connection slots')
  );
}

// Raw Postgres/Supabase error text (constraint names, column names, table names)
// should never reach end users — it's meaningless to them and leaks schema detail.
// Logs the real error server-side and returns a safe, generic message instead.
export function dbErrorResponse<T = never>(
  context: string,
  err: unknown,
  message = 'Something went wrong. Please try again.',
  status = 500,
): NextResponse<T | { error: string }> {
  console.error(`[${context}]`, err);

  if (isConnectionExhaustionError(err)) {
    return NextResponse.json(
      { error: 'The service is temporarily busy. Please try again in a few seconds.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: message }, { status });
}
