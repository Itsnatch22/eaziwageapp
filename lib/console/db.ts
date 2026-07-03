import { Pool } from 'pg';

// Dedicated connection for /console, authenticated as the console_reader
// Postgres role — NOT the app's usual service-role Supabase client. This role
// can only SELECT from green-tier tables and yellow-tier aggregate views (see
// supabase/migrations for the grants); it has no write privileges anywhere,
// enforced at the database level regardless of what application code does.
let pool: Pool | null = null;

function getPool(): Pool {
  const connectionString = process.env.CONSOLE_DATABASE_URL;
  if (!connectionString) {
    throw new Error('CONSOLE_DATABASE_URL is not configured');
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      // pg defaults this to 0 (no timeout) — without it, an unreachable DB
      // (e.g. the IPv6-only direct host from an IPv4-only network) hangs the
      // request forever instead of surfacing the console's "failed to load"
      // error state.
      connectionTimeoutMillis: 8_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

/**
 * Runs a read-only query as console_reader. Rejects any statement that isn't
 * a SELECT/WITH as a defense-in-depth check — the role's own grants are the
 * real boundary, this just fails fast and loudly on an obvious mistake.
 *
 * Supabase's pooler only recognizes standard roles (postgres, etc.) for
 * pooled auth, not the custom console_reader role, so this connection
 * authenticates as postgres. `SET ROLE console_reader` is run and awaited
 * here, synchronously before the actual query, on every checkout — not via
 * the pool's 'connect' event, which fires without anything awaiting it and
 * would let a query race ahead of the role switch and run as postgres.
 * Re-running SET ROLE on an already-switched connection is a harmless no-op.
 */
export async function consoleQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const trimmed = sql.trim().toLowerCase();
  if (!trimmed.startsWith('select') && !trimmed.startsWith('with')) {
    throw new Error('consoleQuery only allows SELECT/WITH statements');
  }
  const client = await getPool().connect();
  try {
    await client.query('SET ROLE console_reader');
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    // RESET ROLE before returning the connection to the pool so a future
    // checkout can't accidentally skip the SET ROLE call and inherit a role
    // from a prior use — belt-and-braces on top of re-running SET ROLE above.
    await client.query('RESET ROLE').catch(() => {});
    client.release();
  }
}
