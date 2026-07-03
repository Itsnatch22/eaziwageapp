import type { SupabaseClient } from '@supabase/supabase-js';
import { DISBURSED_STATUSES } from '@/lib/constants/advance-status';

export type ReportType = 'financial' | 'operational' | 'compliance' | 'performance';

interface AdvanceRow {
  id?: string;
  amount?: number | string | null;
  fee_amount?: number | string | null;
  status?: string | null;
  created_at?: string | null;
  employee_id?: string | null;
  organization_id?: string | null;
}

interface TransactionRow {
  id?: string;
  amount?: number | string | null;
  status?: string | null;
  type?: string | null;
  created_at?: string | null;
  wallet_id?: string | null;
}

interface EmployeeRow {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  status?: string | null;
  created_at?: string | null;
  country?: string | null;
}

interface EmployerRow {
  id?: string;
  company_name?: string | null;
  email?: string | null;
  status?: string | null;
  created_at?: string | null;
  country?: string | null;
  risk_score?: number | string | null;
}

interface KycDocRow {
  id?: string;
  employee_id?: string | null;
  document_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
}

interface FraudAlertRow {
  id?: string;
  alert_type?: string | null;
  severity?: string | null;
  status?: string | null;
  created_at?: string | null;
  description?: string | null;
}

interface ReviewRequestRow {
  status?: string | null;
}

interface ApiHealthRow {
  name?: string | null;
  status?: string | null;
  latency_ms?: number | string | null;
  uptime_percent?: number | string | null;
  created_at?: string | null;
}

interface AuditLogRow {
  id?: string;
  admin_id?: string | null;
  action?: string | null;
  target_type?: string | null;
  created_at?: string | null;
}

export interface ReportMeta {
  name: string;
  description?: string | null;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface GeneratedReport {
  csv: string;
  recordCount: number;
}

export function getDateRangeForPeriod(period: string, reportDate?: string): DateRange {
  const now = reportDate ? new Date(reportDate) : new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'today':
    case 'day':
      return { from: startOfDay, to: endOfDay };

    case 'week': {
      const weekStart = new Date(startOfDay);
      weekStart.setDate(startOfDay.getDate() - startOfDay.getDay());
      return { from: weekStart, to: endOfDay };
    }

    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay };

    case 'quarter':
      return { from: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), to: endOfDay };

    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay };

    case 'custom':
    default: {
      const customStart = new Date(startOfDay);
      customStart.setDate(startOfDay.getDate() - 30);
      return { from: customStart, to: endOfDay };
    }
  }
}

async function generateFinancialReport(supabase: SupabaseClient, dateRange: DateRange, report: ReportMeta): Promise<GeneratedReport> {
  const { data: advances, error: advancesError } = await supabase
    .from('advances')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString())
    .in('status', DISBURSED_STATUSES);
  if (advancesError) throw advancesError;

  const { data: transactions, error: transactionsError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());
  if (transactionsError) throw transactionsError;

  const totalAdvances = advances?.reduce((sum: number, a: AdvanceRow) => sum + Number(a.amount || 0), 0) || 0;
  const totalFees = advances?.reduce((sum: number, a: AdvanceRow) => sum + Number(a.fee_amount || 0), 0) || 0;
  const totalDeposits = transactions?.filter((t: TransactionRow) => t.type === 'deposit')
    .reduce((sum: number, tx: TransactionRow) => sum + Number(tx.amount || 0), 0) || 0;
  const totalWithdrawals = transactions?.filter((t: TransactionRow) => t.type === 'withdrawal' || t.type === 'payout')
    .reduce((sum: number, tx: TransactionRow) => sum + Number(tx.amount || 0), 0) || 0;

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

  advances?.forEach((advance: AdvanceRow) => {
    csv += `\n${advance.id},${advance.amount},${advance.fee_amount},${advance.status},advance,${advance.created_at},${advance.employee_id},${advance.organization_id}`;
  });
  transactions?.forEach((tx: TransactionRow) => {
    csv += `\n${tx.id},${tx.amount},,${tx.status},${tx.type},${tx.created_at},,${tx.wallet_id}`;
  });

  return { csv, recordCount: (advances?.length ?? 0) + (transactions?.length ?? 0) };
}

async function generateOperationalReport(supabase: SupabaseClient, dateRange: DateRange, report: ReportMeta): Promise<GeneratedReport> {
  const { data: employees, error: employeesError } = await supabase
    .from('employee_onboarding')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());
  if (employeesError) throw employeesError;

  const { data: employers, error: employersError } = await supabase
    .from('employers')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());
  if (employersError) throw employersError;

  const { data: advances, error: advancesError } = await supabase
    .from('advances')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());
  if (advancesError) throw advancesError;

  const totalEmployees = employees?.length || 0;
  const totalEmployers = employers?.length || 0;
  const totalAdvances = advances?.length || 0;
  const approvedAdvances = advances?.filter((a: AdvanceRow) => (DISBURSED_STATUSES as readonly string[]).includes(a.status ?? '')).length || 0;
  const pendingAdvances = advances?.filter((a: AdvanceRow) => a.status === 'pending').length || 0;

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

  employees?.forEach((employee: EmployeeRow) => {
    csv += `\n${employee.id},${employee.full_name},${employee.email},${employee.status},${employee.created_at},${employee.country}`;
  });

  csv += `\n\nEmployer Details:
ID,Company Name,Email,Status,Created At,Country,Risk Score`;

  employers?.forEach((employer: EmployerRow) => {
    csv += `\n${employer.id},${employer.company_name},${employer.email},${employer.status},${employer.created_at},${employer.country},${employer.risk_score}`;
  });

  return { csv, recordCount: totalEmployees + totalEmployers + totalAdvances };
}

async function generateComplianceReport(supabase: SupabaseClient, dateRange: DateRange, report: ReportMeta): Promise<GeneratedReport> {
  const { data: kycDocs, error: kycError } = await supabase
    .from('employee_kyc_documents')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());
  if (kycError) throw kycError;

  const { data: fraudAlerts, error: fraudError } = await supabase
    .from('fraud_alerts')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());
  if (fraudError) throw fraudError;

  const { data: reviewRequests, error: reviewError } = await supabase
    .from('review_requests')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());
  if (reviewError) throw reviewError;

  const pendingKYC = kycDocs?.filter((doc: KycDocRow) => doc.status === 'pending').length || 0;
  const approvedKYC = kycDocs?.filter((doc: KycDocRow) => doc.status === 'approved').length || 0;
  const rejectedKYC = kycDocs?.filter((doc: KycDocRow) => doc.status === 'rejected').length || 0;
  const activeFraudAlerts = fraudAlerts?.filter((alert: FraudAlertRow) => alert.status !== 'resolved').length || 0;
  const pendingReviews = reviewRequests?.filter((req: ReviewRequestRow) => req.status === 'pending').length || 0;

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

  kycDocs?.forEach((doc: KycDocRow) => {
    csv += `\n${doc.id},${doc.employee_id},${doc.document_type},${doc.status},${doc.created_at},${doc.reviewed_at}`;
  });

  csv += `\n\nFraud Alerts:
ID,Alert Type,Severity,Status,Created At,Description`;

  fraudAlerts?.forEach((alert: FraudAlertRow) => {
    csv += `\n${alert.id},${alert.alert_type},${alert.severity},${alert.status},${alert.created_at},"${alert.description}"`;
  });

  return { csv, recordCount: (kycDocs?.length ?? 0) + (fraudAlerts?.length ?? 0) + (reviewRequests?.length ?? 0) };
}

async function generatePerformanceReport(supabase: SupabaseClient, dateRange: DateRange, report: ReportMeta): Promise<GeneratedReport> {
  const { data: apiHealth, error: apiError } = await supabase
    .from('api_health')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());
  if (apiError) throw apiError;

  const { data: auditLogs, error: auditError } = await supabase
    .from('system_audit_logs')
    .select('*')
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());
  if (auditError) throw auditError;

  const avgLatency = apiHealth?.reduce((sum: number, h: ApiHealthRow) => sum + Number(h.latency_ms || 0), 0) / (apiHealth?.length || 1);
  const avgUptime = apiHealth?.reduce((sum: number, h: ApiHealthRow) => sum + Number(h.uptime_percent || 0), 0) / (apiHealth?.length || 1);
  const totalAudits = auditLogs?.length || 0;
  const errorAudits = auditLogs?.filter((log: AuditLogRow) => (log.action ?? '').includes('error')).length || 0;

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
API Name,Status,Latency (ms),Uptime (%),Last Checked`;

  apiHealth?.forEach((health: ApiHealthRow) => {
    csv += `\n${health.name},${health.status},${health.latency_ms},${health.uptime_percent},${health.created_at}`;
  });

  csv += `\n\nRecent Audit Events:
ID,Admin ID,Action,Target Type,Created At`;

  auditLogs?.slice(0, 100).forEach((log: AuditLogRow) => {
    csv += `\n${log.id},${log.admin_id},${log.action},${log.target_type},${log.created_at}`;
  });

  return { csv, recordCount: (apiHealth?.length ?? 0) + (auditLogs?.length ?? 0) };
}

/**
 * Runs the actual query/CSV-building work for a report. Shared by the POST route
 * (immediate reports) and the scheduled-reports cron (deferred reports) so both
 * paths produce identical output for the same type/period/date.
 */
export async function generateReportCsv(
  supabase: SupabaseClient,
  type: ReportType,
  period: string,
  report: ReportMeta,
  asOfDate?: string,
): Promise<GeneratedReport> {
  const dateRange = getDateRangeForPeriod(period, asOfDate);
  switch (type) {
    case 'financial':
      return generateFinancialReport(supabase, dateRange, report);
    case 'operational':
      return generateOperationalReport(supabase, dateRange, report);
    case 'compliance':
      return generateComplianceReport(supabase, dateRange, report);
    case 'performance':
      return generatePerformanceReport(supabase, dateRange, report);
    default:
      throw new Error('Unknown report type');
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
