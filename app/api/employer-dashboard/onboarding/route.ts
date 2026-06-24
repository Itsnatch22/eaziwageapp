import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { onboardingSubmitSchema, stepUpdateSchema } from '@/lib/validations/employer-onboarding';
import { getCurrencyFromCountry } from '@/lib/utils';
import EmployerOnboardingConfirmation from '@/lib/emails/EmployerOnboardingConfirmation';
import { notifyAdmin } from '@/lib/notifications';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMPLOYER_DOCUMENT_FIELDS = [
  'certificate_of_incorporation',
  'business_registration',
  'tax_compliance_certificate',
  'cr12_document',
  'kra_pin_certificate',
  'business_permit',
  'audited_financials',
  'bank_statement',
  'proof_of_address',
  'proof_of_bank_account',
  'employment_contract_template',
] as const;

async function getOrCreateDraft(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: existing } = await supabase
    .from('employer_onboarding')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from('employer_onboarding')
    .insert({ user_id: userId, status: 'draft', currency: 'KES' })
    .select('id')
    .single();

  if (error || !created) throw new Error('Could not create onboarding draft.');
  return created.id as string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    // PII — written via upsert_employer_onboarding_pii RPC, not stored raw
    bank_account_number,
    tax_id,
    ...fields
  } = parsed.data;

  try {
    const onboardingId = await getOrCreateDraft(supabase, user.id);

    const employerCurrency = getCurrencyFromCountry(fields.country);
    type OnboardingDraft = Record<(typeof EMPLOYER_DOCUMENT_FIELDS)[number], string | null>;

    const { data: existingDraft } = await supabase
      .from('employer_onboarding')
      .select(EMPLOYER_DOCUMENT_FIELDS.join(','))
      .eq('id', onboardingId)
      .maybeSingle() as { data: OnboardingDraft | null; error: unknown };

    const documentUrls = {
      certificate_of_incorporation: certificate_of_incorporation || existingDraft?.certificate_of_incorporation || null,
      business_registration: business_registration || existingDraft?.business_registration || null,
      tax_compliance_certificate: tax_compliance_certificate || existingDraft?.tax_compliance_certificate || null,
      cr12_document: cr12_document || existingDraft?.cr12_document || null,
      kra_pin_certificate: kra_pin_certificate || existingDraft?.kra_pin_certificate || null,
      business_permit: business_permit || existingDraft?.business_permit || null,
      audited_financials: audited_financials || existingDraft?.audited_financials || null,
      bank_statement: bank_statement || existingDraft?.bank_statement || null,
      proof_of_address: proof_of_address || existingDraft?.proof_of_address || null,
      proof_of_bank_account: proof_of_bank_account || existingDraft?.proof_of_bank_account || null,
      employment_contract_template: employment_contract_template || existingDraft?.employment_contract_template || null,
    };

    const { error: upsertError } = await supabase
      .from('employer_onboarding')
      .update({
        ...fields,
        currency: employerCurrency,
        ...documentUrls,

        status: 'pending',
        risk_score: 0,
        current_step: 7,
        terms_accepted_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    if (upsertError) throw upsertError;

    // Encrypt PII fields — row must exist before this is called
    const { PII_ENCRYPTION_KEY } = getEnv();
    if (!PII_ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'Encryption not configured' }, { status: 500 });
    }

    const { error: piiError } = await supabase.rpc('upsert_employer_onboarding_pii', {
      p_user_id:             user.id,
      p_bank_account_number: bank_account_number ?? null,
      p_tax_id:              tax_id ?? null,
      p_key:                 PII_ENCRYPTION_KEY,
    });

    if (piiError) {
      console.error('[employer/onboarding/pii]', piiError);
      return NextResponse.json({ error: 'Failed to save secure fields' }, { status: 500 });
    }

    const validOwners = beneficial_owners.filter((o) => o.full_name.trim());

    if (validOwners.length > 0) {
      await supabase
        .from('employer_beneficial_owners')
        .delete()
        .eq('onboarding_id', onboardingId);

      const { error: ownersError } = await supabase.from('employer_beneficial_owners').insert(
        validOwners.map((o) => ({ ...o, onboarding_id: onboardingId })),
      );

      if (ownersError) throw ownersError;
    }

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

    await notifyAdmin({
      type: 'employer_kyc',
      title: 'Employer Onboarding Submitted',
      message: `${fields.company_name} has submitted their onboarding application for review.`,
      metadata: {
        user_id: user.id,
        onboarding_id: onboardingId,
        company_name: fields.company_name,
      },
    });

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
