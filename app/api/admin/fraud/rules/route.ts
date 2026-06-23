import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const ruleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  rule_type: z.enum(['amount_threshold', 'frequency', 'velocity', 'pattern', 'employer_manipulation']),
  threshold_value: z.number(),
  threshold_unit: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']),
  action: z.enum(['flag', 'block', 'notify']),
  enabled: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createRouteHandlerClient();
    const { data, error } = await supabase
      .from('fraud_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ rules: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createRouteHandlerClient();
    const body = await req.json();
    const parsed = ruleSchema.parse(body);

    const { data, error } = await supabase
      .from('fraud_rules')
      .insert(parsed)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
