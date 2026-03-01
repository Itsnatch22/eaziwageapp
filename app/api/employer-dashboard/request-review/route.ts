import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend }          from 'resend';
import { z }               from 'zod';
import RiskReviewRequestEmail from '@/lib/emails/RiskRequestReview';

export const runtime = 'nodejs'; // Resend SDK requires Node

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Validation schema ─────────────────────────────────────────────────────────
const bodySchema = z.object({
  employerId: z.string().uuid('employerId must be a valid UUID'),
  type:       z.string().min(1).default('risk_review'),
  message:    z.string().min(1, 'message is required').max(1000),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const raw = await req.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:  'Validation failed',
        detail: parsed.error.issues.map((e) => ({
          field: e.path.join('.'),
          msg:   e.message,
        })),
      },
      { status: 422 },
    );
  }

  const { employerId, type, message } = parsed.data;

  // ── Verify the employer belongs to this user ──────────────────────────────
  const { data: employer, error: empError } = await supabase
    .from('employer_onboarding')
    .select('id, company_name, risk_score, risk_rating, contact_email, contact_person')
    .eq('id', employerId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (empError) {
    return NextResponse.json({ error: empError.message }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json(
      { error: 'Employer not found or access denied.' },
      { status: 403 },
    );
  }

  // ── Duplicate guard: reject if a pending request already exists ───────────
  const { data: existing } = await supabase
    .from('risk_review_requests')
    .select('id')
    .eq('employer_id', employerId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'A review request is already pending for this employer.' },
      { status: 409 },
    );
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const { error: insertError } = await supabase
    .from('risk_review_requests')
    .insert({
      employer_id: employerId,
      user_id:     user.id,
      type,
      message,
      status: 'pending',
    });

  if (insertError) {
    console.error('[request-review] insert:', insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // ── Confirmation email (non-fatal) ────────────────────────────────────────
  const emailTo     = employer.contact_email ?? user.email!;
  const contactName =
    employer.contact_person ??
    (user.user_metadata?.full_name as string | undefined) ??
    'there';

  await resend.emails
    .send({
      from:    'EaziWage Risk Team <noreply@eaziwage.com>',
      to:      emailTo,
      subject: `Risk Score Review Requested — ${employer.company_name}`,
      react:   RiskReviewRequestEmail({
        companyName:   employer.company_name,
        contactEmail:  emailTo,
        contactPerson: contactName,
        currentRating: employer.risk_rating ?? 'B',
        currentScore:  Number(employer.risk_score ?? 3.0),
      }),
    })
    .catch((e) => console.error('[request-review] resend:', e));

  return NextResponse.json(
    { message: 'Review request submitted successfully.' },
    { status: 201 },
  );
}