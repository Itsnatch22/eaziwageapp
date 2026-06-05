import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DEPARTMENTS = [
  'Engineering', 'Sales', 'Marketing', 'Finance', 'Operations',
  'HR', 'Customer Support', 'Product', 'Legal', 'Logistics',
];

const JOB_TITLES: Record<string, string[]> = {
  Engineering:        ['Software Engineer', 'DevOps Engineer', 'QA Engineer', 'Data Analyst'],
  Sales:              ['Sales Executive', 'Account Manager', 'Business Development Rep'],
  Marketing:          ['Marketing Manager', 'Content Strategist', 'SEO Analyst'],
  Finance:            ['Accountant', 'Financial Analyst', 'Payroll Officer'],
  Operations:         ['Operations Manager', 'Logistics Coordinator', 'Supply Chain Analyst'],
  HR:                 ['HR Manager', 'Recruiter', 'People Ops Specialist'],
  'Customer Support': ['Support Agent', 'Customer Success Manager'],
  Product:            ['Product Manager', 'UX Designer', 'Business Analyst'],
  Legal:              ['Legal Counsel', 'Compliance Officer'],
  Logistics:          ['Logistics Officer', 'Fleet Manager'],
};

const FIRST_NAMES = [
  'Amara', 'Brian', 'Cynthia', 'David', 'Esther', 'Felix', 'Grace', 'Hassan',
  'Irene', 'James', 'Kezia', 'Liam', 'Mary', 'Njoroge', 'Olivia', 'Patrick',
  'Queen', 'Robert', 'Sophia', 'Timothy', 'Uwase', 'Victor', 'Wanjiku', 'Xavier',
  'Yohannes', 'Zara', 'Abel', 'Betty', 'Charles', 'Diana', 'Emmanuel', 'Faith',
  'George', 'Hannah', 'Isaac', 'Janet', 'Kevin', 'Lydia', 'Moses', 'Nancy',
];

const LAST_NAMES = [
  'Mwangi', 'Kamau', 'Odhiambo', 'Njeri', 'Otieno', 'Kimani', 'Waweru', 'Achieng',
  'Mutua', 'Ndung\'u', 'Omondi', 'Kariuki', 'Gitonga', 'Auma', 'Kiptoo', 'Chebet',
  'Namukasa', 'Ssemakula', 'Nabwire', 'Nsubuga', 'Bakunda', 'Tendo', 'Rwego', 'Mugisha',
  'Mkandawire', 'Phiri', 'Banda', 'Chirwa', 'Tembo', 'Dlamini', 'Nkosi', 'Mokoena',
];

const CITIES: Record<string, string[]> = {
  KE: ['Nairobi', 'Mombasa', 'Kisumu'],
  UG: ['Kampala', 'Entebbe', 'Jinja'],
  TZ: ['Dar es Salaam', 'Arusha', 'Mwanza'],
  RW: ['Kigali', 'Butare', 'Musanze'],
};

const KYC_STATUSES = ['approved', 'approved', 'approved', 'pending', 'pending', 'under_review'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSalary(): number {
  // Between 25,000 and 250,000 KES, rounded to nearest 5,000
  return Math.round((25000 + Math.random() * 225000) / 5000) * 5000;
}

function randomDate(yearsBack: number): string {
  const ms = Date.now() - Math.random() * yearsBack * 365.25 * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().split('T')[0];
}

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('[seed/demo-employees] Auth error:', authError);
      return NextResponse.json({ error: 'Authentication error', details: authError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, onboarding_id, company_name, country')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (employerError) {
      console.error('[seed/demo-employees] Employer query error:', employerError);
      return NextResponse.json({ error: 'Failed to query employer', details: employerError.message }, { status: 500 });
    }

    if (!employer) {
      return NextResponse.json(
        { error: 'Approved employer profile required to seed employees.' },
        { status: 403 },
      );
    }

    const { count, error: countError } = await supabase
      .from('employee_onboarding')
      .select('id', { count: 'exact', head: true })
      .eq('employer_id', employer.onboarding_id);

    if (countError) {
      console.error('[seed/demo-employees] Count error:', countError);
      return NextResponse.json({ error: 'Failed to count employees', details: countError.message }, { status: 500 });
    }

    if ((count ?? 0) >= 50) {
      return NextResponse.json({
        message: `Already have ${count} employees — skipping seed.`,
      });
    }

    const country = employer.country ?? 'KE';
    const cities  = CITIES[country] ?? CITIES.KE;

    const rows = [];
    
    for (let i = 0; i < 60; i++) {
      const dept      = pick(DEPARTMENTS);
      const titles    = JOB_TITLES[dept] ?? ['Staff'];
      const firstName = pick(FIRST_NAMES);
      const lastName  = pick(LAST_NAMES);
      const kycStatus = pick(KYC_STATUSES);
      const email     = `demo.employee.${i + 1}.${employer.id.substring(0, 8)}@example.com`;

      const { data: demoUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: `DemoPass${Math.random().toString(36).substring(2, 15)}!`,
        email_confirm: true,
        user_metadata: {
          full_name: `${firstName} ${lastName}`,
          role: 'employee',
          is_demo: true,
        },
      });

      if (userError) {
        console.error(`[seed/demo-employees] Failed to create user ${i + 1}:`, userError);
        continue;
      }

      if (!demoUser.user) {
        console.error(`[seed/demo-employees] No user returned for employee ${i + 1}`);
        continue;
      }

      rows.push({
        user_id:         demoUser.user.id, // Unique user_id for each employee
        employer_id:     employer.onboarding_id,
        employee_code:   `EMP-${String(i + 1).padStart(4, '0')}`,
        national_id:     `DEMO-${String(i + 1).padStart(6, '0')}`,
        id_type:         'national_id' as const,
        date_of_birth:   randomDate(35),  // 0-35 years back
        job_title:       pick(titles),
        department:      dept,
        employment_type: pick(['full-time', 'part-time', 'contract']),
        start_date:      randomDate(5),   // up to 5 years ago
        monthly_salary:  randomSalary(),
        country,
        city:            pick(cities),
        address_line1:   `${Math.floor(Math.random() * 999) + 1} Demo Street`,
        address_line2:   null,
        postal_code:     String(Math.floor(Math.random() * 90000) + 10000),
        bank_name:       pick(['KCB', 'Equity Bank', 'NCBA', 'Stanbic', 'Absa']),
        bank_account:    String(Math.floor(Math.random() * 9e9) + 1e9),
        mobile_money_provider: pick(['M-PESA', 'Airtel Money', 'MTN MoMo', 'Tigo Pesa']),
        mobile_money_number:   `+254${Math.floor(Math.random() * 9e8) + 1e8}`,
        status:          kycStatus,
        terms_accepted_at: new Date().toISOString(),
        submitted_at:    new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Failed to create any demo users' }, { status: 500 });
    }

    console.log('[seed/demo-employees] First row to insert:', JSON.stringify(rows[0], null, 2));

    const { error: insertError } = await supabase
      .from('employee_onboarding')
      .insert(rows);

    if (insertError) {
      console.error('[seed/demo-employees] Insert error details:', JSON.stringify(insertError, null, 2));
      return NextResponse.json({ 
        error: 'Failed to seed employees', 
        details: insertError.message,
        hint: insertError.hint,
        code: insertError.code 
      }, { status: 500 });
    }

    return NextResponse.json({
      message: `Seeded ${rows.length} demo employees for ${employer.company_name}.`,
      count: rows.length,
    });
  } catch (error: unknown) {
    console.error('[seed/demo-employees] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: message,
      stack: process.env.NODE_ENV === 'development' ? stack : undefined
    }, { status: 500 });
  }
}
