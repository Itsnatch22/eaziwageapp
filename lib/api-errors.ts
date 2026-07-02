import { NextResponse } from 'next/server';

// Raw Postgres/Supabase error text (constraint names, column names, table names)
// should never reach end users — it's meaningless to them and leaks schema detail.
// Logs the real error server-side and returns a safe, generic message instead.
export function dbErrorResponse(
  context: string,
  err: unknown,
  message = 'Something went wrong. Please try again.',
  status = 500,
): NextResponse {
  console.error(`[${context}]`, err);
  return NextResponse.json({ error: message }, { status });
}
