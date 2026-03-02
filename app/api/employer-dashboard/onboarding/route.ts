// app/api/employer-dashboard/onboarding/route.ts
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { onboardingSubmitSchema, stepUpdateSchema } from '@/lib/validations/employer-onboarding';
import EmployerOnboardingConfirmation from '@/lib/emails/EmployerOnboardingConfirmation';
import pusherServer from '@/lib/pusher-server';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Helper: get or create a draft onboarding row for the authed user ────────
async function getOrCreateDraft(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: existing } = await supabase
    .from('employer_onboarding')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from('employer_onboarding')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (error || !created) throw new Error('Could not create onboarding draft.');
  return created.id as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/employer-dashboard/onboarding
// Final submission — validates full payload, upserts record, sends email
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();

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

  const parsed = onboardingSubmitSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((e) => ({
      field: e.path.join('.'),
      msg: e.message,
    }));
    return NextResponse.json({ error: 'Validation failed', detail }, { status: 422 });
  }

  const {
    beneficial_owners,
    // Destructure doc URL fields so we can store them separately
    certificate_of_incorporation,
    business_registration,
    tax_compliance_certificate,
    cr12_document,
    kra_pin_certificate,
    business_permit,
    audited_financials,
    bank_statement,
    proof_of_address,
    proof_of_bank_account,
    employment_contract_template,
    ...fields
  } = parsed.data;

  try {
    const onboardingId = await getOrCreateDraft(supabase, user.id);

    // ── Upsert main onboarding row ────────────────────────────────────────
    const { error: upsertError } = await supabase
      .from('employer_onboarding')
      .update({
        ...fields,
        // Document URLs
        certificate_of_incorporation: certificate_of_incorporation || null,
        business_registration: business_registration || null,
        tax_compliance_certificate: tax_compliance_certificate || null,
        cr12_document: cr12_document || null,
        kra_pin_certificate: kra_pin_certificate || null,
        business_permit: business_permit || null,
        audited_financials: audited_financials || null,
        bank_statement: bank_statement || null,
        proof_of_address: proof_of_address || null,
        proof_of_bank_account: proof_of_bank_account || null,
        employment_contract_template: employment_contract_template || null,
        // Workflow
        status: 'risk_review_in_progress',
        risk_score: 0,
        current_step: 7,
        terms_accepted_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    if (upsertError) throw upsertError;

    // ── Upsert beneficial owners ──────────────────────────────────────────
    const validOwners = beneficial_owners.filter((o) => o.full_name.trim());

    if (validOwners.length > 0) {
      // Replace all existing owners for this onboarding
      await supabase
        .from('employer_beneficial_owners')
        .delete()
        .eq('onboarding_id', onboardingId);

      const { error: ownersError } = await supabase.from('employer_beneficial_owners').insert(
        validOwners.map((o) => ({ ...o, onboarding_id: onboardingId })),
      );

      if (ownersError) throw ownersError;
    }

    // ── Send confirmation email via Resend ────────────────────────────────
    await resend.emails.send({
      from: 'EaziWage <noreply@eaziwage.com>',
      to: fields.contact_email,
      subject: 'Application Received — EaziWage Employer Portal',
      react: EmployerOnboardingConfirmation({
        companyName: fields.company_name,
        contactPerson: fields.contact_person,
        contactEmail: fields.contact_email,
      }),
    });

    // ── Create Admin Notification ────────────────────────────────────────
    const { data: adminNotif, error: adminNotifError } = await supabase
      .from('admin_notifications')
      .insert({
        type: 'employer_kyc',
        title: 'Employer Onboarding Submitted',
        message: `${fields.company_name} has submitted their onboarding application for review.`,
        read: false,
        metadata: {
          user_id: user.id,
          onboarding_id: onboardingId,
          company_name: fields.company_name,
        },
      })
      .select()
      .single();

    if (!adminNotifError && adminNotif) {
      await pusherServer.trigger('admin-notifications', 'new-notification', adminNotif);
    }

    return NextResponse.json(
      { message: 'Application submitted successfully.', onboarding_id: onboardingId },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error('[onboarding/submit]', err);
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/employer-dashboard/onboarding
// Saves progress (current step) without full validation — called on nextStep()
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = stepUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid step value' }, { status: 400 });
  }

  try {
    const onboardingId = await getOrCreateDraft(supabase, user.id);

    await supabase
      .from('employer_onboarding')
      .update({ current_step: parsed.data.step })
      .eq('id', onboardingId);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employer-dashboard/onboarding
// Returns the current user's draft/application status (resume support)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('employer_onboarding')
    .select('*, employer_beneficial_owners(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}