import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { employeeOnboardingSchema } from '@/lib/validations/employee-validation';
import { getCurrencyFromCountry } from '@/lib/utils';
import EmployeeKycConfirmation from '@/lib/emails/EmployeeKYCConfirmation';
import { notifyAdmin, notifyEmployer } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getEnv } from '@/env';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

function normalizeEmploymentType(value: unknown): 'full-time' | 'part-time' | 'contract' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replace(/_/g, '-');
  if (['full-time', 'part-time', 'contract'].includes(normalized)) {
    return normalized as 'full-time' | 'part-time' | 'contract';
  }
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();

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
  const coerced = {
    ...body,
    monthly_salary: parseFloat(body.monthly_salary) || 0,
    net_monthly_salary: body.net_monthly_salary !== undefined && body.net_monthly_salary !== '' ? parseFloat(body.net_monthly_salary) : undefined,
  };

  const parsed = employeeOnboardingSchema.safeParse(coerced);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((e) => ({
      field: e.path.join('.'),
      msg: e.message,
    }));
    return NextResponse.json({ error: 'Validation failed', detail }, { status: 422 });
  }

  const data = parsed.data;
  const normalizedEmploymentType = normalizeEmploymentType(data.employment_type);
  if (!normalizedEmploymentType) {
    return NextResponse.json(
      { error: 'Invalid employment type. Must be full-time, part-time, or contract.' },
      { status: 422 },
    );
  }

  const adminSupabase = createAdminClient();

  let employerId = data.employer_id;

  if (!employerId && data.company_code) {
    const code = data.company_code.trim().toUpperCase();

    // Primary: employers table (fully-synced records)
    const { data: byCode } = await adminSupabase
      .from('employers')
      .select('id')
      .eq('company_code', code)
      .in('status', ['approved', 'pending'])
      .maybeSingle();

    if (byCode) {
      employerId = byCode.id;
    } else {
      // Fallback: employer_onboarding is the canonical source (populated at registration
      // and admin approval). The employers row may not exist yet if the admin hasn't
      // synced the approval yet.
      const { data: byOnboarding } = await adminSupabase
        .from('employer_onboarding')
        .select('id')
        .ilike('company_code', code)
        .eq('status', 'approved')
        .maybeSingle();

      if (!byOnboarding) {
        return NextResponse.json(
          { error: 'Company code not recognized. Please check it and try again.' },
          { status: 422 },
        );
      }
      employerId = byOnboarding.id;
    }
  }

  if (!employerId) {
    return NextResponse.json(
      { error: 'Please select an employer or enter a company code.' },
      { status: 422 },
    );
  }

  console.log('Verifying employer_id:', employerId);

  const { data: onboardingEmp } = await adminSupabase
    .from('employer_onboarding')
    .select('id, company_name, status, user_id')
    .eq('id', employerId)
    .eq('status', 'approved')
    .maybeSingle();

  let employer = onboardingEmp;

  if (!employer) {
    const { data: syncedEmp } = await adminSupabase
      .from('employers')
      .select('id, company_name, status, user_id')
      .eq('id', employerId)
      .eq('status', 'approved')
      .maybeSingle();

    if (syncedEmp) {
        employer = syncedEmp;
    }
  }

  if (!employer) {
    console.error('[Onboarding] Employer verification failed for ID:', employerId);
    return NextResponse.json(
      { error: 'This employer is not yet approved on EaziWage. Please contact your employer or try again once they are fully onboarded.' },
      { status: 422 },
    );
  }

  // Resolve live employer ID for FK compatibility with the employees table.
  // employerId may be an employer_onboarding.id (legacy); look up the corresponding employers.id.
  let liveEmployerId: string = employerId;
  const { data: liveEmp } = await adminSupabase
    .from('employers')
    .select('id')
    .eq('onboarding_id', employerId)
    .maybeSingle();
  if (liveEmp?.id) {
    liveEmployerId = liveEmp.id;
  } else if (employerId !== liveEmployerId) {
    // employerId is already from employers table — keep it
    liveEmployerId = employerId;
  }

const { data: existing } = await adminSupabase
     .from('employee_onboarding')
     .select('id, status, submitted_at')
     .eq('user_id', user.id)
     .maybeSingle();

   // status alone does NOT mean a real submission happened: the
   // trg_recompute_onboarding_status trigger on employee_kyc_documents
   // flips employee_onboarding.status to 'under_review' (or 'rejected',
   // or even 'approved') purely from document upload/review counts,
   // independent of this route ever running — an applicant who has
   // uploaded all required docs via the wizard but hasn't reached the
   // final "Submit Application" step yet can already be sitting at
   // 'under_review' with submitted_at still null. Gating on status
   // ('pending' only) instead of submitted_at falsely 409'd exactly that
   // in-progress case. submitted_at is the only reliable "was this ever
   // actually submitted" signal — it's set nowhere except here, below.
   const hasGenuineSubmission = existing != null && existing.submitted_at != null;
   if (existing && hasGenuineSubmission && existing.status !== 'rejected') {
     return NextResponse.json(
       { error: 'You already have an active KYC application.' },
       { status: 409 },
     );
   }

   function generateEmployeeCode(employerId: string, userId: string): string {
     const employerPrefix = employerId.slice(-4).toUpperCase();
     const userSuffix = userId.slice(-6).toUpperCase();
     const timestamp = Date.now().toString(36).slice(-3).toUpperCase();
     return `EMP-${employerPrefix}-${userSuffix}-${timestamp}`;
   }

   const {
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
     start_date,
     monthly_salary,
     net_monthly_salary,
     bank_name,
     bank_account,
     mobile_money_provider,
     mobile_money_number,
     face_id,
   } = data;
   // The 8 KYC document URLs (id_front, id_back, address_proof, tax_certificate,
   // payslip_1, payslip_2, bank_statement, employment_contract) are intentionally
   // not destructured here — they're already durably persisted in
   // employee_kyc_documents by the per-file upload endpoint
   // (app/api/employee-dashboard/kyc/documents/route.ts) before this final-submit
   // call happens. employee_onboarding no longer has columns for them.

   const generatedEmployeeCode = employee_code || generateEmployeeCode(employerId, user.id);

   const employeeCurrency = getCurrencyFromCountry(country);

   const employeeName =
     (user.user_metadata?.full_name as string | undefined) ??
     user.email?.split('@')[0] ??
     'there';

   // PII fields (national_id, date_of_birth, tax_id, bank_account, mobile_money_number)
   // are NOT written here — they go through the upsert_employee_onboarding_pii RPC
   // which encrypts them at rest before writing to the DB.
   const upsertPayload = {
     user_id: user.id,
     employer_id: employerId,
     employee_code: generatedEmployeeCode,
     full_name: employeeName,
     email: user.email,
     id_type,
     nationality: nationality || 'Kenyan',
     country,
     address_line1,
     address_line2: address_line2 || null,
     city,
     postal_code: postal_code || null,
     job_title,
     department: department || null,
     employment_type: normalizedEmploymentType,
     start_date: start_date || null,
     monthly_salary,
     net_monthly_salary: net_monthly_salary !== undefined && net_monthly_salary !== null ? net_monthly_salary : monthly_salary,
     net_salary_is_estimated: net_monthly_salary === undefined || net_monthly_salary === null,
     currency: employeeCurrency,
     bank_name,
     mobile_money_provider,

     face_id: face_id || null,

     // status is intentionally omitted: on INSERT the column defaults to 'pending'
     // (correct for a brand-new application); on UPDATE (resubmission) leaving it
     // out means this write doesn't touch the column at all, preserving whatever
     // trg_recompute_onboarding_status already derived from the per-document
     // resubmissions that happened before this final-submit call.
     terms_accepted_at: new Date().toISOString(),
     submitted_at: new Date().toISOString(),
   };

  const { error: upsertError } = existing
    ? await adminSupabase
        .from('employee_onboarding')
        .update(upsertPayload)
        .eq('id', existing.id)
    : await adminSupabase.from('employee_onboarding').insert(upsertPayload);

  if (upsertError) {
     return dbErrorResponse('employee/onboarding/submit', upsertError, 'Failed to submit your application. Please try again.');
   }

  // Encrypt PII fields via DB function — row must exist before this is called
  const { PII_ENCRYPTION_KEY } = getEnv();
  if (!PII_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'Encryption not configured' }, { status: 500 });
  }

  const { error: piiError } = await supabase.rpc('upsert_employee_onboarding_pii', {
    p_user_id:       user.id,
    p_national_id:   national_id,
    p_bank_account:  bank_account ?? null,
    p_mobile_money:  mobile_money_number ?? null,
    p_date_of_birth: date_of_birth,
    p_tax_id:        tax_id ?? null,
    p_key:           PII_ENCRYPTION_KEY,
  });

  if (piiError) {
    console.error('[employee/onboarding/pii]', piiError);
    return NextResponse.json({ error: 'Failed to save secure fields' }, { status: 500 });
  }

  try {
     const { data: emp } = await adminSupabase
       .from('employees')
       .upsert({
         user_id: user.id,
         employer_id: liveEmployerId,
         employee_code: generatedEmployeeCode,
         full_name: employeeName,
         email: user.email,
         phone: user.user_metadata?.phone || null,
         employee_number: generatedEmployeeCode,
         job_title,
         department: department || null,
         monthly_salary,
         employment_type: normalizedEmploymentType,
         status: 'pending',
         kyc_status: 'pending',
         hire_date: start_date ? new Date(start_date).toISOString() : null,
         updated_at: new Date().toISOString(),
       }, { onConflict: 'user_id' })
       .select('id')
       .single();

     // No employee_kyc_documents sync here — the per-file upload endpoint
     // (app/api/employee-dashboard/kyc/documents/route.ts) already upserts each
     // document's row (with a real storage_path) at upload time, which is also
     // what drives trg_recompute_onboarding_status. Re-syncing here previously
     // used a stale document_type taxonomy that no longer matches the table's
     // CHECK constraint and never set storage_path, so it always failed silently.

     if (emp?.id && (bank_name || bank_account || mobile_money_provider || mobile_money_number)) {
       if (bank_name && bank_account) {
         await adminSupabase
           .from('payment_methods')
           .insert({
             employee_id: emp.id,
             country_code: country,
             method_type: 'bank_account',
             provider_name: bank_name,
             account_name: employeeName,
             account_number: bank_account,
             is_default: false,
             is_verified: false,
             is_active: true,
           });
       }
       if (mobile_money_provider && mobile_money_number) {
         await adminSupabase
           .from('payment_methods')
           .insert({
             employee_id: emp.id,
             country_code: country,
             method_type: 'mobile_money',
             provider_name: mobile_money_provider,
             account_name: employeeName,
             phone_number: mobile_money_number,
             is_default: false,
             is_verified: false,
             is_active: true,
           });
       }
     }
   } catch (err) {
     console.error('[onboarding/sync-employees]', err);
   }

  try {
    if (employer.id) {
      if (employer.user_id) {
        await notifyEmployer({
          userId: employer.user_id,
          type: 'employee',
          title: 'New Employee Registration',
          message: `${employeeName} has submitted their KYC application.`,
        });
      }
    }

    await notifyAdmin({
      type: 'review_request',
      title: 'New KYC Application',
      message: `${employeeName} from ${employer.company_name} has submitted a new KYC application for review.`,
      metadata: {
        employee_id: user.id,
        employer_id: employer.id,
        company_name: employer.company_name,
      },
    });
  } catch (notifErr) {
    console.error('[onboarding/notifications]', notifErr);
  }

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
    .catch((e) => console.error('[resend]', e));

  return NextResponse.json(
    { 
      message: 'KYC application submitted successfully.',
      employee_code: generatedEmployeeCode
    },
    { status: 201 },
  );
}

export async function GET() {
  const supabase = await createRouteHandlerClient();

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
    console.error('[employee-onboarding/GET] DB error:', error);
    return NextResponse.json({ error: 'Failed to fetch onboarding data' }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}