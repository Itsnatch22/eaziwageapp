import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFounder } from '@/lib/server/admin-auth';
import { checkRateLimit, apiLimiter } from '@/lib/rate-limit';
import { getConsoleContext } from '@/lib/console/data';
import { summarizeWithCohere } from '@/lib/console/ai-summarize';
import { logConsoleAccess } from '@/lib/console/audit';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  question: z.string().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const auth = await requireFounder();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `console-query:${ip}`);
  if (!rateResult.success) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: rateResult.headers });
  }

  const raw = await req.json().catch(() => null);
  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 422 });
  }

  try {
    // Ad-hoc questions are answered against the same pre-aggregated green/yellow
    // context used for the dashboard sections — the AI never gets a path to
    // construct its own SQL, so it can't reach outside this scope.
    const context = await getConsoleContext();
    const summary = await summarizeWithCohere(parsed.data.question, context);

    void logConsoleAccess({
      adminId: user.id,
      adminEmail: user.email,
      action: 'console_query',
      queryText: parsed.data.question,
      summaryReturned: summary,
    });

    return NextResponse.json({ summary, generatedAt: context.generatedAt });
  } catch (err) {
    console.error('[console/query] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to summarize query';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
