import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-reconciliation:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const env = getEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    // 1. Fetch all onboarded employers (submitted, approved, etc.)
    const { data: employers, error: empError } = await supabase
      .from('employer_onboarding')
      .select('id, company_name, status')
      .in('status', ['submitted', 'approved', 'suspended', 'risk_review_in_progress']);

    if (empError) throw empError;

    // 2. Fetch all disbursed and repaid advances
    const { data: advances, error: advError } = await supabase
      .from('advances')
      .select(`
        id,
        amount,
        fee_amount,
        status,
        reference,
        created_at,
        employer_id,
        employee:employee_id (full_name)
      `)
      .in('status', ['disbursed', 'repaid']);

    if (advError) throw advError;

    // 3. Initialize byEmployer map with all onboarded employers
    const byEmployer: Record<string, {
      employer_id: string;
      employer_name: string;
      status: string;
      total_advances: number;
      total_amount: number;
      total_fees: number;
      recouped: number;
      pending_recoupment: number;
      advances: Array<{
        id: string;
        reference: string;
        employee_name: string;
        amount: number;
        status: 'repaid' | 'pending';
        created_at: string;
      }>;
    }> = {};
    (employers || []).forEach(emp => {
      byEmployer[emp.id] = {
        employer_id: emp.id,
        employer_name: emp.company_name || 'Unknown Employer',
        status: emp.status,
        total_advances: 0,
        total_amount: 0,
        total_fees: 0,
        recouped: 0,
        pending_recoupment: 0,
        advances: [],
      };
    });

    // 4. Aggregate advance data
    let totalDisbursed = 0;
    let totalFees = 0;
    let totalRecouped = 0;
    let pendingRecoupment = 0;

    (advances || []).forEach((adv) => {
      const employerId = adv.employer_id;
      
      // If for some reason the employer isn't in our list (e.g. status was rejected)
      // we still want to track the money if it exists
      if (!byEmployer[employerId]) {
        byEmployer[employerId] = {
          employer_id: employerId,
          employer_name: 'Unknown Employer (Inactive)',
          status: 'inactive',
          total_advances: 0,
          total_amount: 0,
          total_fees: 0,
          recouped: 0,
          pending_recoupment: 0,
          advances: [],
        };
      }

      const amount = Number(adv.amount || 0);
      const fee = Number(adv.fee_amount || 0);
      const total = amount + fee;

      byEmployer[employerId].total_advances += 1;
      byEmployer[employerId].total_amount += amount;
      byEmployer[employerId].total_fees += fee;
      
      if (adv.status === 'repaid') {
        byEmployer[employerId].recouped += total;
        totalRecouped += total;
      } else {
        byEmployer[employerId].pending_recoupment += total;
        pendingRecoupment += total;
      }

      totalDisbursed += amount;
      totalFees += fee;

      const employeeRelation = adv.employee as
        | { full_name?: string }
        | Array<{ full_name?: string }>
        | null
        | undefined;
      const employeeName = Array.isArray(employeeRelation)
        ? employeeRelation[0]?.full_name
        : employeeRelation?.full_name;

      byEmployer[employerId].advances.push({
        id: adv.id,
        reference: adv.reference,
        employee_name: employeeName || 'Unknown Employee',
        amount: total,
        status: adv.status === 'repaid' ? 'repaid' : 'pending',
        created_at: adv.created_at,
      });
    });

    const result = {
      summary: {
        total_employers: Object.keys(byEmployer).length,
        total_disbursed: totalDisbursed,
        total_fees: totalFees,
        total_recouped: totalRecouped,
        pending_recoupment: pendingRecoupment,
      },
      by_employer: Object.values(byEmployer).sort((a, b) => {
        // Sort by amount first, then by name
        if (b.total_amount !== a.total_amount) return b.total_amount - a.total_amount;
        return a.employer_name.localeCompare(b.employer_name);
      }),
    };

    return NextResponse.json(result, { status: 200, headers: rateResult.headers });
  } catch (error) {
    console.error('[GET /api/admin/reconciliation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation data.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
