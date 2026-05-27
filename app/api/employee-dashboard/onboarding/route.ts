import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { employeeOnboardingSchema } from '@/lib/validations/employee-validation';
import { getCurrencyFromCountry } from '@/lib/utils';
import EmployeeKycConfirmation from '@/lib/emails/EmployeeKYCConfirmation';
import pusherServer from '@/lib/pusher-server';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

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

  console.log('Verifying employer_id:', data.employer_id);
  
  const { data: onboardingEmp } = await adminSupabase
    .from('employer_onboarding')
    .select('id, company_name, status, user_id')
    .eq('id', data.employer_id)
    .in('status', ['approved', 'submitted', 'under_review', 'pending'])
    .maybeSingle();

  let employer = onboardingEmp;

  if (!employer) {
    const { data: syncedEmp } = await adminSupabase
      .from('employers')
      .select('id, company_name, status, user_id')
      .eq('id', data.employer_id)
      .in('status', ['approved', 'pending'])
      .maybeSingle();
    
    if (syncedEmp) {
        employer = syncedEmp;
    }
  }

  if (!employer) {
    console.error('[Onboarding] Employer verification failed for ID:', data.employer_id);
    return NextResponse.json(
      { error: 'Selected employer is not registered on EaziWage.' },
      { status: 422 },
    );
  }

  const { data: existing } = await adminSupabase
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

  function generateEmployeeCode(employerId: string, userId: string): string {
    const employerPrefix = employerId.slice(-4).toUpperCase();
    const userSuffix = userId.slice(-6).toUpperCase();
    const timestamp = Date.now().toString(36).slice(-3).toUpperCase();
    return `EMP-${employerPrefix}-${userSuffix}-${timestamp}`;
  }

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
    start_date,
    monthly_salary,
    bank_name,
    bank_account,
    mobile_money_provider,
    mobile_money_number,
    face_id,
    id_front,
    id_back,
    address_proof,
    tax_certificate,
    payslip_1,
    payslip_2,
    bank_statement,
    employment_contract,
  } = data;

  const generatedEmployeeCode = employee_code || generateEmployeeCode(employer_id, user.id);

  const employeeCurrency = getCurrencyFromCountry(country);

  const employeeName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'there';

  const upsertPayload = {
    user_id: user.id,
    employer_id,
    employee_code: generatedEmployeeCode,
    full_name: employeeName,
    email: user.email,
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
    employment_type: normalizedEmploymentType,
    start_date: start_date || null,
    monthly_salary,
    bank_name,
    bank_account,
    mobile_money_provider,
    mobile_money_number,
    currency: employeeCurrency,
    // Documents
    face_id: face_id || null,
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
    ? await adminSupabase
        .from('employee_onboarding')
        .update(upsertPayload)
        .eq('id', existing.id)
    : await adminSupabase.from('employee_onboarding').insert(upsertPayload);

  if (upsertError) {
    console.error('[employee/onboarding/submit]', upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }
  try {
    await adminSupabase
      .from('employees')
      .upsert({
        user_id: user.id,
        employer_id,
        employee_code: generatedEmployeeCode,
        name: employeeName, // Use name field as per schema
        full_name: employeeName, // Keep both for compatibility
        email: user.email,
        phone: user.user_metadata?.phone || null,
        employee_number: generatedEmployeeCode, // Use employee_code as employee_number
        job_title,
        department: department || null,
        monthly_salary,
        employment_type: normalizedEmploymentType,
        status: 'pending',
        kyc_status: 'pending',
        hire_date: start_date ? new Date(start_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    const docSyncs = [];
    const idDocType = data.id_type === 'passport' ? 'passport' : 'national_id';
    
    if (face_id) docSyncs.push({ user_id: user.id, document_type: 'face_id', document_url: face_id, status: 'pending' });
    if (id_front) docSyncs.push({ user_id: user.id, document_type: idDocType, document_url: id_front, status: 'pending' });
    if (address_proof) docSyncs.push({ user_id: user.id, document_type: 'utility_bill', document_url: address_proof, status: 'pending' });
    if (tax_certificate) docSyncs.push({ user_id: user.id, document_type: 'tax_certificate', document_url: tax_certificate, status: 'pending' });
    if (payslip_1) docSyncs.push({ user_id: user.id, document_type: 'payslip', document_url: payslip_1, status: 'pending' });
    if (bank_statement) docSyncs.push({ user_id: user.id, document_type: 'bank_statement', document_url: bank_statement, status: 'pending' });
    if (employment_contract) docSyncs.push({ user_id: user.id, document_type: 'employment_contract', document_url: employment_contract, status: 'pending' });

    if (docSyncs.length > 0) {
      await adminSupabase.from('employee_kyc_documents').upsert(docSyncs, { onConflict: 'user_id,document_type' });
    }
  } catch (err) {
    console.error('[onboarding/sync-employees]', err);
  }

  try {
    if (employer.id) {
      await pusherServer.trigger(`employer-${employer.id}`, 'employee-kyc-update', {
        employee_name: employeeName,
        status: 'pending'
      });

      if (employer.user_id) {
        const { data: empNotif, error: empNotifError } = await adminSupabase
          .from('notifications')
          .insert({
            user_id: employer.user_id,
            type: 'employee',
            title: 'New Employee Registration',
            message: `${employeeName} has submitted their KYC application.`,
            read: false,
          })
          .select()
          .single();

        if (!empNotifError && empNotif) {
          await pusherServer.trigger(`employer-${employer.user_id}`, 'new-notification', empNotif);
        }
      }
    }

    const { data: adminNotif, error: adminNotifError } = await adminSupabase
      .from('admin_notifications')
      .insert({
        type: 'review_request',
        title: 'New KYC Application',
        message: `${employeeName} from ${employer.company_name} has submitted a new KYC application for review.`,
        read: false,
        metadata: {
          employee_id: user.id,
          employer_id: employer.id,
          company_name: employer.company_name,
        },
      })
      .select()
      .single();

    if (!adminNotifError && adminNotif) {
      await pusherServer.trigger('admin-notifications', 'new-notification', adminNotif);
    }
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
    .catch((e) => console.error('[resend]', e)); // non-fatal

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}
