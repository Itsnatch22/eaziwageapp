// app/api/employer/request-review/route.ts
//
// POST — Creates a risk review request record and sends confirmation email.
//        Guards against duplicate pending requests.
//
import { createClient } from '@/lib/client';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { reviewRequestSchema } from '@/lib/validations/risk-validation';
import RiskRequest from '@/lib/emails/RiskRequest';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse & validate body ─────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = reviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((e) => ({ field: e.path.join('.'), msg: e.message }));
    return NextResponse.json({ error: 'Validation failed', detail }, { status: 422 });
  }

  const { employerId, type, message } = parsed.data;

  // ── Verify the employer belongs to this user ──────────────────────────────
  const { data: employer, error: employerError } = await supabase
    .from('employer_onboarding')
    .select('id, company_name, risk_score, risk_rating, contact_email, contact_person')
    .eq('id', employerId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (employerError || !employer) {
    return NextResponse.json({ error: 'Employer not found or access denied.' }, { status: 403 });
  }

  // ── Guard: block duplicate pending requests ───────────────────────────────
  const { data: existingRequest } = await supabase
    .from('risk_review_requests')
    .select('id')
    .eq('employer_id', employerId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingRequest) {
    return NextResponse.json(
      { error: 'A review request is already pending for this employer.' },
      { status: 409 },
    );
  }

  // ── Insert review request ─────────────────────────────────────────────────
  const { error: insertError } = await supabase.from('risk_review_requests').insert({
    employer_id: employerId,
    user_id: user.id,
    type,
    message,
    status: 'pending',
  });

  if (insertError) {
    console.error('[request-review/insert]', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // ── Send confirmation email ───────────────────────────────────────────────
  const emailTo = employer.contact_email ?? user.email!;
  const contactPerson =
    employer.contact_person ??
    (user.user_metadata?.full_name as string | undefined) ??
    'there';

  await resend.emails
    .send({
      from: 'EaziWage Risk Team <noreply@eaziwage.com>',
      to: emailTo,
      subject: `Risk Review Requested — ${employer.company_name}`,
      react: RiskRequest({
        companyName: employer.company_name,
        contactEmail: emailTo,
        contactPerson,
        currentRating: employer.risk_rating ?? 'B',
        currentScore: Number(employer.risk_score ?? 3.0),
      }),
    })
    .catch((e) => console.error('[resend/risk-review]', e)); // non-fatal

  return NextResponse.json(
    { message: 'Review request submitted successfully.' },
    { status: 201 },
  );
}