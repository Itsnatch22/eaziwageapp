import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { z }                        from 'zod';
import { getEnv }                   from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

// ─── Schema ───────────────────────────────────────────────────────────────────

const StatusUpdateSchema = z.object({
  status: z.string().refine(value => ['approved', 'pending', 'rejected', 'suspended'].includes(value), {
    message: 'Status is required.',
    path: ['status'],
  }),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // ── 1. Rate-limit ──────────────────────────────────────────────────────────
  const ip         = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employer-status:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  // ── 2. Auth check (admin-only) ────────────────────────────────────────────
  // TODO: Replace with actual admin auth middleware/session check

  // ── 3. Parse + validate body ───────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.', code: 'BAD_REQUEST' },
      { status: 400 },
    );
  }

  const parsed = StatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Invalid request.',
        code:  'VALIDATION_ERROR',
      },
      { status: 400 },
    );
  }

  const { status } = parsed.data;

  // ── 4. Supabase service-role client ───────────────────────────────────────
  const env      = getEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ── 5. Update employer status ─────────────────────────────────────────────
  const { data, error } = await supabase
    .from('employers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[PATCH /api/admin/employers/:id/status] Supabase error:', error);
    return NextResponse.json(
      { error: 'Failed to update employer status.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Employer not found.', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { success: true, employer: data },
    { status: 200, headers: rateResult.headers },
  );
}