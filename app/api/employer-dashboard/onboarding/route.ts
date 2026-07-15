import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { onboardingSubmitSchema, stepUpdateSchema } from '@/lib/validations/employer-onboarding';
import { getCurrencyFromCountry } from '@/lib/utils';
import EmployerOnboardingConfirmation from '@/lib/emails/EmployerOnboardingConfirmation';
import { notifyAdmin } from '@/lib/notifications';
import { getEnv } from '@/env';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

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

  // Enabled Countries (Global Settings) — gate onboarding to countries the
  // platform is actually configured to serve. Defaults to all four supported
  // countries when unset so this never blocks anyone before an admin opts in.
  const { data: globalSettingsRow } = await createAdminClient()
    .from('global_settings')
    .select('platform_settings')
    .eq('id', 'default')
    .maybeSingle();
  const enabledCountries = (globalSettingsRow?.platform_settings as { enabled_countries?: string[] } | null)?.enabled_countries
    ?? ['KE', 'UG', 'TZ', 'RW'];
  if (parsed.data.country && !enabledCountries.includes(parsed.data.country.toUpperCase())) {
    return NextResponse.json(
      { error: `EaziWage is not currently available in ${parsed.data.country}.` },
      { status: 422 },
    );
  }

  const {
    beneficial_owners,
    // The 11 KYC document URLs are intentionally not destructured here —
    // they're already durably persisted in employer_kyc_documents by the
    // per-file upload endpoint (app/api/employer-dashboard/onboarding/upload/route.ts)
    // before this final-submit call happens. employer_onboarding no longer
    // has columns for them.
    /* eslint-disable @typescript-eslint/no-unused-vars */
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
    // PII — encrypted at rest, written via upsert_employer_onboarding_pii
    // RPC rather than stored raw in the plain .update() below
    bank_account_number,
    mobile_money_number,
    tax_id,
    /* eslint-enable @typescript-eslint/no-unused-vars */
    ...fields
  } = parsed.data;

  try {
    const onboardingId = await getOrCreateDraft(supabase, user.id);

    const employerCurrency = getCurrencyFromCountry(fields.country);

    const { error: upsertError } = await supabase
      .from('employer_onboarding')
      .update({
        ...fields,
        currency: employerCurrency,

        // 'submitted' — unlike pending/under_review/approved/rejected, this
        // is the one status trg_recompute_employer_onboarding_status can
        // never derive on its own, so it's a legitimate one-time manual
        // write at the moment the employer actually submits the form.
        status: 'submitted',
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

    // upsert_employer_onboarding_pii is restricted to service_role — must go
    // through the admin client, not the regular user-scoped one.
    const { error: piiError } = await createAdminClient().rpc('upsert_employer_onboarding_pii', {
      p_onboarding_id:        onboardingId,
      p_bank_account_number:  bank_account_number ?? null,
      p_mobile_money_number:  mobile_money_number ?? null,
      p_key:                  PII_ENCRYPTION_KEY,
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
    return NextResponse.json({ error: 'Failed to submit your application. Please try again.' }, { status: 500 });
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
    console.error('[onboarding/PATCH]', err);
    return NextResponse.json({ error: 'Failed to save progress. Please try again.' }, { status: 500 });
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
    console.error('[employer-onboarding/GET] DB error:', error);
    return NextResponse.json({ error: 'Failed to fetch onboarding data' }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}
