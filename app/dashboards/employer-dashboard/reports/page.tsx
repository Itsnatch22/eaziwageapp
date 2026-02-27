// @ts-nocheck
"use client"
import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, Calendar,
  Users, CreditCard, DollarSign, PieChart, ArrowUpRight, ArrowDownRight,
  FileText, Wallet, Activity, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { formatCurrency, cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportsData {
  period: { label: string; from: string; to: string };
  advances: {
    total: number; disbursed: number; pending: number; rejected: number;
    total_amount: number; total_fees: number; avg_amount: number;
    by_method: { mobile_money: number; bank_transfer: number };
  };
  employees: {
    total: number; active: number; with_advances: number; utilization_rate: number;
  };
  risk_score:  number | null;
  risk_rating: string | null;
  previous_period: { total_amount: number; total_fees: number };
  monthly_trend: Array<{ label: string; amount: number; count: number }>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const MetricCard = ({ title, value, change, changeType, icon: Icon }) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:shadow-lg transition-all">
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-white" />
      </div>
      {change !== undefined && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
          changeType === 'positive'
            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
        )}>
          {changeType === 'positive'
            ? <ArrowUpRight className="w-3 h-3" />
            : <ArrowDownRight className="w-3 h-3" />}
          {change}
        </div>
      )}
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    {change !== undefined && <p className="text-xs text-slate-400 mt-1">vs last period</p>}
  </div>
);

const DonutChart = ({ mobileMoneyCount, bankTransferCount, total }) => {
  const pct  = total > 0 ? (mobileMoneyCount / total) * 100 : 0;
  const circ = 2 * Math.PI * 40;
  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10"
          className="text-slate-200 dark:text-slate-700/50" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="url(#donutGradient)" strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          className="transition-all duration-1000" />
        <defs>
          <linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0df259" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-slate-900 dark:text-white">{total}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
      </div>
    </div>
  );
};

const ProgressItem = ({ label, value, total, color }) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-semibold text-slate-900 dark:text-white">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const MiniBarChart = ({ trend }: { trend: ReportsData['monthly_trend'] }) => {
  const max = Math.max(...trend.map(t => t.amount), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {trend.map((t, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-linear-to-t from-primary to-emerald-400 rounded-t-sm transition-all duration-700"
            style={{ height: `${Math.max((t.amount / max) * 80, t.amount > 0 ? 4 : 0)}px` }}
            title={`${t.label}: ${formatCurrency(t.amount)}`}
          />
          <span className="text-[10px] text-slate-400 truncate w-full text-center">{t.label}</span>
        </div>
      ))}
    </div>
  );
};

const ReportCard = ({ icon: Icon, title, description, onClick, disabled = false }) => (
  <div
    onClick={disabled ? undefined : onClick}
    className={cn(
      "flex items-center gap-4 p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl transition-all group",
      disabled
        ? "opacity-50 cursor-not-allowed"
        : "hover:bg-white/60 dark:hover:bg-slate-800/60 cursor-pointer"
    )}
  >
    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="flex-1">
      <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
    <Download className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
  </div>
);

const SummaryRow = ({ label, value, valueColor = '' }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-200/50 dark:border-slate-700/30 last:border-0">
    <span className="text-slate-600 dark:text-slate-400">{label}</span>
    <span className={cn("font-semibold", valueColor || "text-slate-900 dark:text-white")}>{value}</span>
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(current: number, previous: number): { label: string; type: 'positive' | 'negative' } | undefined {
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return { label: '+100%', type: 'positive' };
  const diff = ((current - previous) / previous) * 100;
  const sign  = diff >= 0 ? '+' : '';
  return {
    label: `${sign}${diff.toFixed(1)}%`,
    type:  diff >= 0 ? 'positive' : 'negative',
  };
}

function generateCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployerReports() {
  const [data,    setData]    = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [selectedMonth,  setSelectedMonth]  = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchReports = useCallback(async (period: string, month: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period, month });
      const res = await fetch(`/api/employer-dashboard/reports?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data ?? null);
    } catch (err: any) {
      console.error('[reports] fetch failed:', err);
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(selectedPeriod, selectedMonth);
  }, [selectedPeriod, selectedMonth, fetchReports]);

  // ── Download handlers ─────────────────────────────────────────────────────

  const downloadAdvances = () => {
    if (!data) return;
    const adv = data.advances;
    generateCSV([
      ['Report', 'Advances Summary'],
      ['Period', data.period.label],
      [''],
      ['Metric', 'Value'],
      ['Total Requests', String(adv.total)],
      ['Disbursed', String(adv.disbursed)],
      ['Pending', String(adv.pending)],
      ['Rejected', String(adv.rejected)],
      ['Total Amount Disbursed', String(adv.total_amount)],
      ['Total Fees Collected', String(adv.total_fees)],
      ['Average Advance Amount', String(adv.avg_amount.toFixed(2))],
      ['Mobile Money', String(adv.by_method.mobile_money)],
      ['Bank Transfer', String(adv.by_method.bank_transfer)],
    ], `advances-summary-${data.period.label.replace(/\s+/g, '-').toLowerCase()}.csv`);
  };

  const downloadEmployees = () => {
    if (!data) return;
    const emp = data.employees;
    generateCSV([
      ['Report', 'Employee Summary'],
      ['Period', data.period.label],
      [''],
      ['Metric', 'Value'],
      ['Total Employees', String(emp.total)],
      ['Active Employees', String(emp.active)],
      ['Employees with Advances', String(emp.with_advances)],
      ['Utilization Rate (%)', String(emp.utilization_rate)],
    ], `employee-report-${data.period.label.replace(/\s+/g, '-').toLowerCase()}.csv`);
  };

  const downloadFinancial = () => {
    if (!data) return;
    const prev = data.previous_period;
    generateCSV([
      ['Report', 'Financial Report'],
      ['Period', data.period.label],
      [''],
      ['Metric', 'Current Period', 'Previous Period'],
      ['Total Disbursed', String(data.advances.total_amount), String(prev.total_amount)],
      ['Total Fees', String(data.advances.total_fees), String(prev.total_fees)],
      ['Average Advance', String(data.advances.avg_amount.toFixed(2)), ''],
    ], `financial-report-${data.period.label.replace(/\s+/g, '-').toLowerCase()}.csv`);
  };

  const downloadPayroll = () => {
    if (!data) return;
    const rows: string[][] = [
      ['Report', 'Payroll Reconciliation'],
      ['Period', data.period.label],
      [''],
      ['Month', 'Total Disbursed', 'Advance Count'],
    ];
    data.monthly_trend.forEach(t => {
      rows.push([t.label, String(t.amount), String(t.count)]);
    });
    generateCSV(rows, `payroll-reconciliation-${data.period.label.replace(/\s+/g, '-').toLowerCase()}.csv`);
  };

  const downloadAll = () => {
    if (!data) return;
    downloadAdvances();
    downloadEmployees();
    downloadFinancial();
    downloadPayroll();
  };

  // ── Derived metrics ───────────────────────────────────────────────────────

  const amountChange   = data ? pctChange(data.advances.total_amount, data.previous_period.total_amount) : undefined;
  const feesChange     = data ? pctChange(data.advances.total_fees,   data.previous_period.total_fees)   : undefined;

  if (loading) {
    return (
      <EmployerPortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployerPortalLayout>
    );
  }

  if (error) {
    return (
      <EmployerPortalLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-red-500 font-semibold">{error}</p>
          <Button onClick={() => fetchReports(selectedPeriod, selectedMonth)}
            className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      </EmployerPortalLayout>
    );
  }

  const adv = data?.advances;
  const emp = data?.employees;

  return (
    <EmployerPortalLayout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="reports-title">
              Reports &amp; Analytics
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {data?.period.label ?? 'Loading…'} · Insights into your EaziWage program
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {/* Month selector */}
            <div className="flex items-center gap-2 px-3 h-10 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <Calendar className="w-4 h-4 text-primary" />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none w-32"
              />
            </div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700" data-testid="period-select">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={downloadAll}
              disabled={!data}
              className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
              data-testid="download-report-btn"
            >
              <Download className="w-4 h-4" />
              Download All
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Disbursed"
            value={formatCurrency(adv?.total_amount ?? 0)}
            change={amountChange?.label}
            changeType={amountChange?.type}
            icon={DollarSign}
          />
          <MetricCard
            title="Total Fees Collected"
            value={formatCurrency(adv?.total_fees ?? 0)}
            change={feesChange?.label}
            changeType={feesChange?.type}
            icon={Wallet}
          />
          <MetricCard
            title="Avg. Advance Amount"
            value={formatCurrency(adv?.avg_amount ?? 0)}
            icon={Activity}
          />
          <MetricCard
            title="Utilization Rate"
            value={`${emp?.utilization_rate ?? 0}%`}
            icon={Users}
          />
        </div>

        {/* Monthly Trend */}
        {data?.monthly_trend && data.monthly_trend.length > 0 && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Monthly Disbursements</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Last 6 months</p>
              </div>
            </div>
            <MiniBarChart trend={data.monthly_trend} />
          </div>
        )}

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Disbursement by Method */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <PieChart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Disbursement by Method</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">How employees receive advances</p>
              </div>
            </div>
            <DonutChart
              mobileMoneyCount={adv?.by_method.mobile_money ?? 0}
              bankTransferCount={adv?.by_method.bank_transfer ?? 0}
              total={adv?.total ?? 0}
            />
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-primary rounded-full" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mobile Money</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-white">{adv?.by_method.mobile_money ?? 0}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    ({adv?.total > 0 ? (((adv.by_method.mobile_money) / adv.total) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Bank Transfer</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-white">{adv?.by_method.bank_transfer ?? 0}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    ({adv?.total > 0 ? (((adv.by_method.bank_transfer) / adv.total) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Breakdown */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Employee Breakdown</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Program adoption statistics</p>
              </div>
            </div>
            <div className="space-y-4">
              <ProgressItem
                label="Total Enrolled"
                value={emp?.total ?? 0}
                total={Math.max(emp?.total ?? 0, 1)}
                color="bg-gradient-to-r from-primary to-emerald-500"
              />
              <ProgressItem
                label="Active Employees"
                value={emp?.active ?? 0}
                total={emp?.total || 1}
                color="bg-gradient-to-r from-emerald-500 to-teal-500"
              />
              <ProgressItem
                label="Used Advances"
                value={emp?.with_advances ?? 0}
                total={emp?.total || 1}
                color="bg-gradient-to-r from-blue-500 to-indigo-500"
              />
            </div>
            <div className="mt-6 p-4 bg-linear-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 rounded-xl border border-primary/10">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">Utilization Rate</span>
                <span className="text-2xl font-bold text-primary">{emp?.utilization_rate ?? 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Monthly Summary */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Period Summary</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{data?.period.label}</p>
              </div>
            </div>
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              <SummaryRow label="Total Requests"   value={adv?.total ?? 0} />
              <SummaryRow label="Disbursed"         value={adv?.disbursed ?? 0}  valueColor="text-emerald-600" />
              <SummaryRow label="Pending"           value={adv?.pending ?? 0}    valueColor="text-amber-600" />
              <SummaryRow label="Rejected"          value={adv?.rejected ?? 0}   valueColor="text-red-600" />
              <SummaryRow label="Total Amount"      value={formatCurrency(adv?.total_amount ?? 0)} valueColor="text-primary" />
              <SummaryRow label="Total Fees"        value={formatCurrency(adv?.total_fees ?? 0)} />
            </div>
          </div>

          {/* Available Reports */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Available Reports</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Download as CSV</p>
              </div>
            </div>
            <div className="space-y-3">
              <ReportCard
                icon={CreditCard}
                title="Advances Summary"
                description="All advance requests and status"
                onClick={downloadAdvances}
                disabled={!data}
              />
              <ReportCard
                icon={Users}
                title="Employee Report"
                description="Enrollment and activity data"
                onClick={downloadEmployees}
                disabled={!data}
              />
              <ReportCard
                icon={DollarSign}
                title="Financial Report"
                description="Fees, disbursements and period comparison"
                onClick={downloadFinancial}
                disabled={!data}
              />
              <ReportCard
                icon={Calendar}
                title="Payroll Reconciliation"
                description="Monthly disbursements breakdown"
                onClick={downloadPayroll}
                disabled={!data}
              />
            </div>
          </div>
        </div>

        {/* Risk Score Card */}
        {(data?.risk_score != null) && (
          <div className="bg-linear-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/10 dark:border-primary/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Company Risk Score</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Your risk assessment determines fee rates for employee advances
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                      className="text-white/50 dark:text-slate-700/50" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="url(#riskGradient)" strokeWidth="8"
                      strokeLinecap="round" strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - (data.risk_score / 5))}
                      className="transition-all duration-1000" />
                    <defs>
                      <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0df259" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                      {data.risk_score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-xl font-semibold text-sm",
                  data.risk_score >= 4 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                  data.risk_score >= 3 ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' :
                  data.risk_score >= 2.6 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                  'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                )}>
                  {data.risk_score >= 4 ? 'Low Risk' :
                   data.risk_score >= 3 ? 'Medium Risk' :
                   data.risk_score >= 2.6 ? 'High Risk' : 'Very High Risk'}
                  {data.risk_rating && ` (${data.risk_rating})`}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </EmployerPortalLayout>
  );
}
