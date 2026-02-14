import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth';
import { EarningsService } from '@/lib/services/earningService';

export async function GET(request: Request) {
  try {
    // Secure with cron secret
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();

    // Get all active employees
    const { data: employees } = await (await supabase)
      .from('employees')
      .select('id')
      .eq('status', 'Active');

    if (!employees) {
      return NextResponse.json({ message: 'No active employees' });
    }

    // Recompute earnings for each employee
    const earningsService = new EarningsService();
    const results = await Promise.allSettled(
      employees.map(emp => earningsService.recomputeEmployeeEarnings(emp.id))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      message: 'Earnings recomputed',
      summary: {
        total: employees.length,
        successful,
        failed
      }
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to recompute earnings' },
      { status: 500 }
    );
  }
}