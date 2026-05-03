import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

async function verifyAdminUser(supabase: any): Promise<{ user: any; isAdmin: boolean }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, isAdmin: false };
  }

  // Check environment admin emails first (most reliable)
  const env = getEnv();
  const adminEmails = (env.ADMIN_EMAILS || '')
    .replace(/^"|"$/g, '')
    .split(',')
    .map(e => e.trim().toLowerCase());
  const isEnvAdmin = adminEmails.includes(user.email?.toLowerCase() || '');

  if (isEnvAdmin) {
    return { user, isAdmin: true };
  }

  // Check user metadata roles
  const roleCandidates = [user.app_metadata?.role, user.user_metadata?.role]
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.toLowerCase());

  const allowedRoles = ['admin', 'super_admin', 'compliance', 'employer_admin'];
  const isAdminRoleFinal = roleCandidates.some((role) => allowedRoles.includes(role));

  return { user, isAdmin: isAdminRoleFinal };
}

interface DateRange {
  from: Date;
  to: Date;
}

function getDateRangeForPeriod(period: string, reportDate?: string): DateRange {
  const now = reportDate ? new Date(reportDate) : new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'today':
    case 'day':
      return { from: startOfDay, to: endOfDay };
    
    case 'week':
      const weekStart = new Date(startOfDay);
      weekStart.setDate(startOfDay.getDate() - startOfDay.getDay());
      return { from: weekStart, to: endOfDay };
    
    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: monthStart, to: endOfDay };
    
    case 'quarter':
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return { from: quarterStart, to: endOfDay };
    
    case 'year':
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return { from: yearStart, to: endOfDay };
    
    case 'custom':
    default:
      // For custom, return last 30 days as default
      const customStart = new Date(startOfDay);
      customStart.setDate(startOfDay.getDate() - 30);
      return { from: customStart, to: endOfDay };
  }
}

async function generateFinancialReport(supabase: any, dateRange: DateRange, report: any): Promise<string> {
  try {
    // Get advances data for financial metrics
    const { data: advances, error: advancesError } = await supabase
      .from('advances')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())
      .eq('status', 'disbursed');

    if (advancesError) throw advancesError;

    // Get wallet transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (transactionsError) throw transactionsError;

    // Calculate financial metrics
    const totalAdvances = advances?.reduce((sum: number, advance: any) => sum + Number(advance.amount || 0), 0) || 0;
    const totalFees = advances?.reduce((sum: number, advance: any) => sum + Number(advance.fee_amount || 0), 0) || 0;
    const totalDeposits = transactions?.filter((t: any) => t.type === 'deposit')
      .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0) || 0;
    const totalWithdrawals = transactions?.filter((t: any) => t.type === 'withdrawal' || t.type === 'payout')
      .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0) || 0;

    let csv = `Financial Report: ${report.name}
Generated: ${new Date().toISOString()}
Period: ${dateRange.from.toISOString()} to ${dateRange.to.toISOString()}

Summary Statistics:
Total Advances Disbursed,${totalAdvances}
Total Fees Collected,${totalFees}
Total Deposits,${totalDeposits}
Total Withdrawals,${totalWithdrawals}
Net Revenue,${totalFees}

Transaction Details:
ID,Amount,Fee,Status,Type,Created At,Employee ID,Employer ID`;

    // Add advance details
    advances?.forEach((advance: any) => {
      csv += `\n${advance.id},${advance.amount},${advance.fee_amount},${advance.status},advance,${advance.created_at},${advance.employee_id},${advance.organization_id}`;
    });

    // Add transaction details
    transactions?.forEach((tx: any) => {
      csv += `\n${tx.id},${tx.amount},,${tx.status},${tx.type},${tx.created_at},,${tx.wallet_id}`;
    });

    return csv;
  } catch (error) {
    console.error('Error generating financial report:', error);
    throw error;
  }
}

async function generateOperationalReport(supabase: any, dateRange: DateRange, report: any): Promise<string> {
  try {
    // Get employee onboarding data
    const { data: employees, error: employeesError } = await supabase
      .from('employee_onboarding')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (employeesError) throw employeesError;

    // Get employer data
    const { data: employers, error: employersError } = await supabase
      .from('employers')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (employersError) throw employersError;

    // Get advances data
    const { data: advances, error: advancesError } = await supabase
      .from('advances')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (advancesError) throw advancesError;

    // Calculate operational metrics
    const totalEmployees = employees?.length || 0;
    const totalEmployers = employers?.length || 0;
    const totalAdvances = advances?.length || 0;
    const approvedAdvances = advances?.filter((a: any) => a.status === 'disbursed').length || 0;
    const pendingAdvances = advances?.filter((a: any) => a.status === 'pending').length || 0;

    let csv = `Operational Report: ${report.name}
Generated: ${new Date().toISOString()}
Period: ${dateRange.from.toISOString()} to ${dateRange.to.toISOString()}

Summary Statistics:
Total New Employees,${totalEmployees}
Total New Employers,${totalEmployers}
Total Advance Requests,${totalAdvances}
Approved Advances,${approvedAdvances}
Pending Advances,${pendingAdvances}
Approval Rate,${totalAdvances > 0 ? ((approvedAdvances / totalAdvances) * 100).toFixed(2) : 0}%

Employee Details:
ID,Name,Email,Status,Created At,Country`;

    employees?.forEach((employee: any) => {
      csv += `\n${employee.id},${employee.full_name},${employee.email},${employee.status},${employee.created_at},${employee.country}`;
    });

    csv += `\n\nEmployer Details:
ID,Company Name,Email,Status,Created At,Country,Risk Score`;

    employers?.forEach((employer: any) => {
      csv += `\n${employer.id},${employer.company_name},${employer.email},${employer.status},${employer.created_at},${employer.country},${employer.risk_score}`;
    });

    return csv;
  } catch (error) {
    console.error('Error generating operational report:', error);
    throw error;
  }
}

async function generateComplianceReport(supabase: any, dateRange: DateRange, report: any): Promise<string> {
  try {
    // Get KYC documents
    const { data: kycDocs, error: kycError } = await supabase
      .from('employee_kyc_documents')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (kycError) throw kycError;

    // Get fraud alerts
    const { data: fraudAlerts, error: fraudError } = await supabase
      .from('fraud_alerts')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (fraudError) throw fraudError;

    // Get review requests
    const { data: reviewRequests, error: reviewError } = await supabase
      .from('review_requests')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (reviewError) throw reviewError;

    // Calculate compliance metrics
    const pendingKYC = kycDocs?.filter((doc: any) => doc.status === 'pending').length || 0;
    const approvedKYC = kycDocs?.filter((doc: any) => doc.status === 'approved').length || 0;
    const rejectedKYC = kycDocs?.filter((doc: any) => doc.status === 'rejected').length || 0;
    const activeFraudAlerts = fraudAlerts?.filter((alert: any) => alert.status !== 'resolved').length || 0;
    const pendingReviews = reviewRequests?.filter((req: any) => req.status === 'pending').length || 0;

    let csv = `Compliance Report: ${report.name}
Generated: ${new Date().toISOString()}
Period: ${dateRange.from.toISOString()} to ${dateRange.to.toISOString()}

Summary Statistics:
Pending KYC Reviews,${pendingKYC}
Approved KYC,${approvedKYC}
Rejected KYC,${rejectedKYC}
Active Fraud Alerts,${activeFraudAlerts}
Pending Review Requests,${pendingReviews}

KYC Documents:
ID,Employee ID,Document Type,Status,Created At,Reviewed At`;

    kycDocs?.forEach((doc: any) => {
      csv += `\n${doc.id},${doc.employee_id},${doc.document_type},${doc.status},${doc.created_at},${doc.reviewed_at}`;
    });

    csv += `\n\nFraud Alerts:
ID,Alert Type,Severity,Status,Created At,Description`;

    fraudAlerts?.forEach((alert: any) => {
      csv += `\n${alert.id},${alert.alert_type},${alert.severity},${alert.status},${alert.created_at},"${alert.description}"`;
    });

    return csv;
  } catch (error) {
    console.error('Error generating compliance report:', error);
    throw error;
  }
}

async function generatePerformanceReport(supabase: any, dateRange: DateRange, report: any): Promise<string> {
  try {
    // Get API health data
    const { data: apiHealth, error: apiError } = await supabase
      .from('api_health')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (apiError) throw apiError;

    // Get system audit logs
    const { data: auditLogs, error: auditError } = await supabase
      .from('system_audit_logs')
      .select('*')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (auditError) throw auditError;

    // Calculate performance metrics
    const avgLatency = apiHealth?.reduce((sum: number, health: any) => sum + Number(health.latency_ms || 0), 0) / (apiHealth?.length || 1);
    const avgUptime = apiHealth?.reduce((sum: number, health: any) => sum + Number(health.uptime_percent || 0), 0) / (apiHealth?.length || 1);
    const totalAudits = auditLogs?.length || 0;
    const errorAudits = auditLogs?.filter((log: any) => log.action.includes('error')).length || 0;

    let csv = `Performance Report: ${report.name}
Generated: ${new Date().toISOString()}
Period: ${dateRange.from.toISOString()} to ${dateRange.to.toISOString()}

Summary Statistics:
Average API Latency (ms),${avgLatency.toFixed(2)}
Average Uptime (%),${avgUptime.toFixed(2)}
Total Audit Events,${totalAudits}
Error Events,${errorAudits}
Error Rate (%),${totalAudits > 0 ? ((errorAudits / totalAudits) * 100).toFixed(2) : 0}

API Health Metrics:
API Name,Status,Latitude (ms),Uptime (%),Last Checked`;

    apiHealth?.forEach((health: any) => {
      csv += `\n${health.name},${health.status},${health.latency_ms},${health.uptime_percent},${health.created_at}`;
    });

    csv += `\n\nRecent Audit Events:
ID,Admin ID,Action,Target Type,Created At`;

    auditLogs?.slice(0, 100).forEach((log: any) => {
      csv += `\n${log.id},${log.admin_id},${log.action},${log.target_type},${log.created_at}`;
    });

    return csv;
  } catch (error) {
    console.error('Error generating performance report:', error);
    throw error;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-reports-download:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers },
    );
  }

  const env = getEnv();
  const supabase = await createRouteHandlerClient();

  try {
    // Verify the user is an admin using the same logic as admin me route
    const { user, isAdmin } = await verifyAdminUser(supabase);

    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the report
    const { data: report, error: fetchError } = await supabase
      .from('admin_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.status !== 'ready') {
      return NextResponse.json(
        { error: 'Report is not ready for download' },
        { status: 400 }
      );
    }

    // Generate real CSV data based on report type and period
    let csvContent = '';
    const dateRange = getDateRangeForPeriod(report.period, report.generated_at);
    
    try {
      switch (report.type) {
        case 'financial':
          csvContent = await generateFinancialReport(supabase, dateRange, report);
          break;
        case 'operational':
          csvContent = await generateOperationalReport(supabase, dateRange, report);
          break;
        case 'compliance':
          csvContent = await generateComplianceReport(supabase, dateRange, report);
          break;
        case 'performance':
          csvContent = await generatePerformanceReport(supabase, dateRange, report);
          break;
        default:
          throw new Error('Unknown report type');
      }
    } catch (error) {
      console.error('Error generating report data:', error);
      // Fallback to basic report info if data generation fails
      csvContent = `Report: ${report.name}
Description: ${report.description}
Generated: ${report.generated_at}
Type: ${report.type}
Period: ${report.period}

Error: Failed to generate report data. Please contact support.
`;
    }

    const filename = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        ...rateResult.headers,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('[GET /api/admin/reports/[id]/download] Error:', error);
    return NextResponse.json(
      { error: 'Failed to download report.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
