// app/api/seed/demo-employees/route.ts
//
// POST /api/seed/demo-employees
//
// Seeds 60 realistic demo employees linked to the authenticated employer.
// Only works for approved employers. Idempotent: won't seed twice.
//
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // needs crypto for UUIDs

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

const COUNTRIES = ['KE', 'UG', 'TZ', 'RW'];
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
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Resolve employer ──────────────────────────────────────────────────────
  const { data: employer, error: employerError } = await supabase
    .from('employer_onboarding')
    .select('id, company_name, country')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (employerError) {
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json(
      { error: 'Approved employer profile required to seed employees.' },
      { status: 403 },
    );
  }

  // ── Idempotency: don't seed if already have 50+ ───────────────────────────
  const { count } = await supabase
    .from('employee_onboarding')
    .select('id', { count: 'exact', head: true })
    .eq('employer_id', employer.id);

  if ((count ?? 0) >= 50) {
    return NextResponse.json({
      message: `Already have ${count} employees — skipping seed.`,
    });
  }

  // ── Build 60 employees ────────────────────────────────────────────────────
  const country = employer.country ?? 'KE';
  const cities  = CITIES[country] ?? CITIES.KE;

  const rows = Array.from({ length: 60 }, (_, i) => {
    const dept     = pick(DEPARTMENTS);
    const titles   = JOB_TITLES[dept] ?? ['Staff'];
    const firstName = pick(FIRST_NAMES);
    const lastName  = pick(LAST_NAMES);
    const kycStatus = pick(KYC_STATUSES);

    return {
      user_id:         user.id, // will be updated per-user in real flows; placeholder here
      employer_id:     employer.id,
      employee_code:   `EMP-${String(i + 1).padStart(4, '0')}`,
      // full_name stored via user metadata in real flow; here we embed it as national_id alias
      national_id:     `DEMO-${String(i + 1).padStart(6, '0')}`,
      id_type:         'national_id' as const,
      date_of_birth:   randomDate(35),  // 0-35 years back
      job_title:       pick(titles),
      department:      dept,
      employment_type: pick(['full_time', 'part_time', 'contract']),
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
    };
  });

  const { error: insertError } = await supabase
    .from('employee_onboarding')
    .insert(rows);

  if (insertError) {
    console.error('[seed/demo-employees]', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Seeded 60 demo employees for ${employer.company_name}.`,
    count: 60,
  });
}