// app/api/employee-dashboard/onboarding/route.ts
//
// POST — Submit full employee KYC application
// GET  — Fetch the current user's existing application (for resume / status check)
//
import { createClient } from '@/lib/client';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { employeeOnboardingSchema } from '@/lib/validations/employee-validation';
import EmployeeKycConfirmation from '@/lib/emails/EmployeeKYCConfirmation';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/employee-dashboard/onboarding
// ─────────────────────────────────────────────────────────────────────────────
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

  // ── Parse & validate ──────────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Coerce monthly_salary to number before validation
  const coerced = {
    ...body,
    monthly_salary: parseFloat(body.monthly_salary) || 0,
  };

  const parsed = employeeOnboardingSchema.safeParse(coerced);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((e: { path: any[]; message: any; }) => ({
      field: e.path.join('.'),
      msg: e.message,
    }));
    return NextResponse.json({ error: 'Validation failed', detail }, { status: 422 });
  }

  const data = parsed.data;

  // ── Verify the employer exists and is approved ────────────────────────────
  const { data: employer, error: employerError } = await supabase
    .from('employer_onboarding')
    .select('id, company_name, status')
    .eq('id', data.employer_id)
    .eq('status', 'approved')
    .maybeSingle();

  if (employerError || !employer) {
    return NextResponse.json(
      { error: 'Selected employer is not registered or not yet approved on EaziWage.' },
      { status: 422 },
    );
  }

  // ── Check for duplicate application ──────────────────────────────────────
  const { data: existing } = await supabase
    .from('employee_onboarding')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing && existing.status !== 'rejected') {
    return NextResponse.json(
      { error: 'You already have an active KYC application.' },
      { status: 409 },
    );
  }

  // ── Upsert employee KYC record ────────────────────────────────────────────
  const {
    employer_id,
    employee_code,
    national_id,
    id_type,
    nationality,
    date_of_birth,
    country,
    address_line1,
    address_line2,
    city,
    postal_code,
    tax_id,
    job_title,
    department,
    employment_type,
    start_date,
    monthly_salary,
    bank_name,
    bank_account,
    mobile_money_provider,
    mobile_money_number,
    id_front,
    id_back,
    address_proof,
    tax_certificate,
    payslip_1,
    payslip_2,
    bank_statement,
    employment_contract,
  } = data;

  const upsertPayload = {
    user_id: user.id,
    employer_id,
    employee_code: employee_code || null,
    national_id,
    id_type,
    nationality: nationality || null,
    date_of_birth,
    country,
    address_line1,
    address_line2: address_line2 || null,
    city,
    postal_code: postal_code || null,
    tax_id: tax_id || null,
    job_title,
    department: department || null,
    employment_type,
    start_date: start_date || null,
    monthly_salary,
    bank_name,
    bank_account,
    mobile_money_provider,
    mobile_money_number,
    // Documents
    id_front: id_front || null,
    id_back: id_back || null,
    address_proof: address_proof || null,
    tax_certificate: tax_certificate || null,
    payslip_1: payslip_1 || null,
    payslip_2: payslip_2 || null,
    bank_statement: bank_statement || null,
    employment_contract: employment_contract || null,
    // Workflow
    status: 'pending' as const,
    terms_accepted_at: new Date().toISOString(),
    submitted_at: new Date().toISOString(),
  };

  const { error: upsertError } = existing
    ? await supabase
        .from('employee_onboarding')
        .update(upsertPayload)
        .eq('id', existing.id)
    : await supabase.from('employee_onboarding').insert(upsertPayload);

  if (upsertError) {
    console.error('[employee/onboarding/submit]', upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // ── Get user profile for the email ───────────────────────────────────────
  // user.email comes directly from Supabase Auth
  const employeeName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'there';

  // ── Send confirmation email ───────────────────────────────────────────────
  await resend.emails
    .send({
      from: 'EaziWage <onboarding@contact.eaziwage.com>',
      to: user.email!,
      subject: 'KYC Application Received — EaziWage',
      react: EmployeeKycConfirmation({
        employeeName,
        employeeEmail: user.email!,
        companyName: employer.company_name,
      }),
    })
    .catch((e) => console.error('[resend]', e)); // non-fatal

  return NextResponse.json(
    { message: 'KYC application submitted successfully.' },
    { status: 201 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employee-dashboard/onboarding
// Returns the current user's existing KYC application (status check / resume)
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
    .from('employee_onboarding')
    .select(`
      *,
      employer:employer_id (
        id,
        company_name,
        industry,
        city,
        country
      )
    `)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}