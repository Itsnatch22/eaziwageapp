"use client"
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Download, Calendar, 
  Users, CreditCard, DollarSign, PieChart, ArrowUpRight, ArrowDownRight,
  FileText, Wallet, Activity,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
import { EmployerPortalLayout } from '../../components/employer/EmployerLayout';
import { dashboardApi, advanceApi, employeeApi, employerApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';

// Metric Card with Trend - solid green icon
const MetricCard = ({ title, value, change, changeType, icon: Icon }) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:shadow-lg transition-all">
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-white" />
      </div>
      {change && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
          changeType === 'positive' 
            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
            : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
        )}>
          {changeType === 'positive' ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {change}
        </div>
      )}
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    {change && <p className="text-xs text-slate-400 mt-1">vs last period</p>}
  </div>
);

// Donut Chart Visualization
const DonutChart = ({ data, total, label }) => {
  const percentage1 = total > 0 ? (data[0].value / total) * 100 : 0;
  const circumference = 2 * Math.PI * 40;
  
  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" 
          className="text-slate-200 dark:text-slate-700/50" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="url(#donutGradient)" strokeWidth="10" 
          strokeLinecap="round" strokeDasharray={circumference} 
          strokeDashoffset={circumference * (1 - percentage1 / 100)}
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
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </div>
    </div>
  );
};

// Progress Bar Item
const ProgressItem = ({ label, value, total, color }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-semibold text-slate-900 dark:text-white">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-1000", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Report Download Card with solid green icon
const ReportCard = ({ icon: Icon, title, description, onClick }) => (
  <div 
    onClick={onClick}
    className="flex items-center gap-4 p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all cursor-pointer group"
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

// Summary Row Item
const SummaryRow = ({ label, value, valueColor }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-200/50 dark:border-slate-700/30 last:border-0">
    <span className="text-slate-600 dark:text-slate-400">{label}</span>
    <span className={cn("font-semibold", valueColor || "text-slate-900 dark:text-white")}>{value}</span>
  </div>
);

export default function EmployerReports() {
  const [stats, setStats] = useState(null);
  const [employer, setEmployer] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, employerRes, advancesRes, employeesRes] = await Promise.all([
          dashboardApi.getEmployerDashboard(),
          employerApi.getMe(),
          advanceApi.list(),
          employeeApi.list()
        ]);
        setStats(statsRes.data);
        setEmployer(employerRes.data);
        setAdvances(advancesRes.data);
        setEmployees(employeesRes.data);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Calculate report data
  const totalDisbursed = advances.filter(a => a.status === 'disbursed').reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalFees = advances.filter(a => a.status === 'disbursed').reduce((sum, a) => sum + (a.fee_amount || 0), 0);
  const avgAdvanceAmount = advances.length > 0 ? totalDisbursed / advances.filter(a => a.status === 'disbursed').length || 0 : 0;

  const advancesByMethod = {
    mobile_money: advances.filter(a => a.disbursement_method === 'mobile_money').length,
    bank_transfer: advances.filter(a => a.disbursement_method === 'bank_transfer').length
  };

  const employeeStats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'approved').length,
    withAdvances: new Set(advances.map(a => a.employee_id)).size,
    utilizationRate: employees.length > 0 
      ? ((new Set(advances.map(a => a.employee_id)).size / employees.length) * 100).toFixed(1)
      : 0
  };

  const advanceStats = {
    total: advances.length,
    approved: advances.filter(a => a.status === 'approved' || a.status === 'disbursed').length,
    pending: advances.filter(a => a.status === 'pending').length,
    rejected: advances.filter(a => a.status === 'rejected').length
  };

  if (loading) {
    return (
      <EmployerPortalLayout employer={employer}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployerPortalLayout>
    );
  }

  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="reports-title">
              Reports & Analytics
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Insights into your EaziWage program performance
            </p>
          </div>
          <div className="flex gap-3">
            {/* Month Selector */}
            <div className="flex items-center gap-2 px-3 h-10 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <Calendar className="w-4 h-4 text-primary" />
              <input 
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none w-32 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert-[0.4] [&::-webkit-calendar-picker-indicator]:sepia [&::-webkit-calendar-picker-indicator]:saturate-[10] [&::-webkit-calendar-picker-indicator]:hue-rotate-[90deg]"
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
              className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
              data-testid="download-report-btn"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Total Disbursed"
            value={formatCurrency(totalDisbursed)}
            change="+12.5%"
            changeType="positive"
            icon={DollarSign}
          />
          <MetricCard 
            title="Total Fees Collected"
            value={formatCurrency(totalFees)}
            change="+8.2%"
            changeType="positive"
            icon={Wallet}
          />
          <MetricCard 
            title="Avg. Advance Amount"
            value={formatCurrency(avgAdvanceAmount)}
            change="-2.1%"
            changeType="negative"
            icon={Activity}
          />
          <MetricCard 
            title="Utilization Rate"
            value={`${employeeStats.utilizationRate}%`}
            change="+5.3%"
            changeType="positive"
            icon={Users}
          />
        </div>

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
              data={[
                { label: 'Mobile Money', value: advancesByMethod.mobile_money },
                { label: 'Bank Transfer', value: advancesByMethod.bank_transfer }
              ]}
              total={advances.length}
              label="Total"
            />
            
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-primary rounded-full" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mobile Money</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-white">{advancesByMethod.mobile_money}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    ({advances.length > 0 ? ((advancesByMethod.mobile_money / advances.length) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Bank Transfer</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-white">{advancesByMethod.bank_transfer}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    ({advances.length > 0 ? ((advancesByMethod.bank_transfer / advances.length) * 100).toFixed(0) : 0}%)
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
                value={employeeStats.total} 
                total={Math.max(employeeStats.total, 1)} 
                color="bg-gradient-to-r from-primary to-emerald-500"
              />
              <ProgressItem 
                label="Active Users" 
                value={employeeStats.active} 
                total={employeeStats.total || 1} 
                color="bg-gradient-to-r from-emerald-500 to-teal-500"
              />
              <ProgressItem 
                label="Used Advances" 
                value={employeeStats.withAdvances} 
                total={employeeStats.total || 1} 
                color="bg-gradient-to-r from-blue-500 to-indigo-500"
              />
            </div>
            
            <div className="mt-6 p-4 bg-gradient-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 rounded-xl border border-primary/10">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">Utilization Rate</span>
                <span className="text-2xl font-bold text-primary">{employeeStats.utilizationRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row - Summary & Reports */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Monthly Summary */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Monthly Summary</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Key metrics for current period</p>
              </div>
            </div>
            
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              <SummaryRow label="Total Requests" value={advanceStats.total} />
              <SummaryRow label="Disbursed" value={advanceStats.approved} valueColor="text-emerald-600" />
              <SummaryRow label="Rejected" value={advanceStats.rejected} valueColor="text-red-600" />
              <SummaryRow label="Total Amount" value={formatCurrency(totalDisbursed)} valueColor="text-primary" />
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
                <p className="text-sm text-slate-500 dark:text-slate-400">Download detailed reports</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <ReportCard 
                icon={CreditCard}
                title="Advances Summary"
                description="All advance requests and status"
              />
              <ReportCard 
                icon={Users}
                title="Employee Report"
                description="Enrollment and activity data"
              />
              <ReportCard 
                icon={DollarSign}
                title="Financial Report"
                description="Fees and disbursements"
              />
              <ReportCard 
                icon={Calendar}
                title="Payroll Reconciliation"
                description="Monthly deductions report"
              />
            </div>
          </div>
        </div>

        {/* Risk Score Card */}
        {(stats?.risk_score || employer?.risk_score) && (
          <div className="bg-gradient-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/10 dark:border-primary/20">
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
                      strokeDashoffset={2 * Math.PI * 40 * (1 - ((stats?.risk_score || employer?.risk_score || 0) / 5))}
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
                      {(stats?.risk_score || employer?.risk_score || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-xl font-semibold text-sm",
                  (stats?.risk_score || 0) >= 4 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                  (stats?.risk_score || 0) >= 3 ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' :
                  (stats?.risk_score || 0) >= 2.6 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                  'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                )}>
                  {(stats?.risk_score || 0) >= 4 ? 'Low Risk' :
                   (stats?.risk_score || 0) >= 3 ? 'Medium Risk' :
                   (stats?.risk_score || 0) >= 2.6 ? 'High Risk' : 'Very High Risk'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </EmployerPortalLayout>
  );
}
