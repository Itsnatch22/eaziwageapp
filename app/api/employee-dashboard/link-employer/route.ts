import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveEmployerByCode } from '@/lib/services/resolve-employer-by-code';

export const runtime = 'nodejs';

const LinkEmployerSchema = z.object({
  company_code: z.string().min(1, 'A company code is required').max(20),
});

// Recovery path for accounts that reached the dashboard with no employer
// link — the silent-skip/referral paths at registration, or an OAuth
// sign-up (which never collects a company code at all). Deliberately
// set-once: once employer_id is populated, this route refuses to change
// it, matching how the link is locked in everywhere else (registration,
// KYC onboarding) — an employee can't freely hop employers later, which
// could otherwise be used to dodge repayment obligations tied to advances
// with a former employer.
export async function PATCH(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = LinkEmployerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'A company code is required' },
      { status: 422 },
    );
  }

  const adminSupabase = createAdminClient();

  const { data: existing, error: fetchError } = await adminSupabase
    .from('employee_onboarding')
    .select('id, employer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('[link-employer] fetch failed:', fetchError);
    return NextResponse.json({ error: 'Failed to load your account.' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'No onboarding record found for your account.' }, { status: 404 });
  }
  if (existing.employer_id) {
    return NextResponse.json(
      { error: 'Your account is already linked to an employer.' },
      { status: 409 },
    );
  }

  const resolved = await resolveEmployerByCode(adminSupabase, parsed.data.company_code);

  if (resolved.status === 'not_found') {
    return NextResponse.json(
      { error: 'Company code not found. Please search again.' },
      { status: 422 },
    );
  }
  if (resolved.status === 'rejected' || resolved.status === 'suspended') {
    return NextResponse.json(
      { error: `This company is currently ${resolved.status} on EaziWage. Please contact support.` },
      { status: 422 },
    );
  }
  if (resolved.status === 'not_approved') {
    return NextResponse.json(
      { error: 'This company has not finished onboarding yet. Please try again once they have completed setup.' },
      { status: 422 },
    );
  }

  const { error: updateError } = await adminSupabase
    .from('employee_onboarding')
    .update({ employer_id: resolved.onboardingId, updated_at: new Date().toISOString() })
    .eq('id', existing.id);

  if (updateError) {
    console.error('[link-employer] update failed:', updateError);
    return NextResponse.json({ error: 'Failed to link employer. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Employer linked successfully.',
    company_name: resolved.companyName,
  });
}
