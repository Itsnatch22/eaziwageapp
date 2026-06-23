"use client";

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Building2, Search, Download,
  CheckCircle2, Clock,
  RefreshCw, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';

type IconSize = 'sm' | 'md';
type IconComponent = React.ComponentType<{ className?: string }>;

interface EmployerReconRowProps {
  employer: {
    employer_id: string;
    employer_name: string;
    total_advances: number;
    total_amount: number;
    total_fees: number;
    pending_recoupment: number;
    recouped: number;
    recoupmentRate?: number;
    advances?: {
      id: string;
      reference: string;
      employee_name: string;
      amount: number;
      status: string;
    }[];
  };
  onExpand: () => void;
  expanded: boolean;
}

interface GradientIconBoxProps {
  icon: IconComponent;
  size?: IconSize;
  variant?: 'purple' | 'green' | 'amber';
}
const GradientIconBox = ({ icon: Icon, size = 'md', variant = 'purple' }: GradientIconBoxProps) => {
  const sizes = { sm: 'w-10 h-10', md: 'w-12 h-12' };
  const iconSizes = { sm: 'w-5 h-5', md: 'w-6 h-6' };
  const variants = {
    purple: 'from-purple-600 to-indigo-600 shadow-purple-500/25',
    green: 'from-primary to-emerald-600 shadow-primary/25',
    amber: 'from-amber-500 to-orange-500 shadow-amber-500/25'
  };
  
  return (
    <div className={cn("rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg", sizes[size], variants[variant])}>
      <Icon className={cn("text-white", iconSizes[size])} />
    </div>
  );
};

interface StatusBadgeProps {
  status: 'recouped' | 'pending' | 'overdue';
}
const StatusBadge = ({ status }: StatusBadgeProps) => {
  const styles = {
    recouped: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    pending: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
    overdue: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
  };
  return (
    <span className={cn("px-2.5 py-1 rounded-lg text-xs font-medium", styles[status] || styles.pending)}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

interface SummaryCardProps {
  icon: IconComponent;
  label: string;
  value: string | number;
  subvalue?: string;
  variant?: 'purple' | 'green' | 'amber';
}
const SummaryCard = ({ icon, label, value, subvalue, variant }: SummaryCardProps) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-center gap-3 mb-3">
      <GradientIconBox icon={icon} size="sm" variant={variant} />
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
    </div>
    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    {subvalue && <p className="text-xs text-slate-500 mt-1">{subvalue}</p>}
  </div>
);

const EmployerReconRow = ({ employer, onExpand, expanded }: EmployerReconRowProps) => {
  const recoupmentRate = employer.total_amount > 0 
    ? (employer.recouped / (employer.total_amount + employer.total_fees)) * 100
    : 0;

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
        onClick={onExpand}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-linear-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white">{employer.employer_name}</p>
            <p className="text-sm text-slate-500">{employer.total_advances} advances</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(employer.total_amount + employer.total_fees, 'USD')}</p>
            <p className="text-xs text-slate-500">Total owed</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="font-bold text-emerald-600">{formatCurrency(employer.recouped, 'USD')}</p>
            <p className="text-xs text-slate-500">Recouped</p>
          </div>
          <div className="text-right">
            <p className={cn(
              "font-bold",
              recoupmentRate >= 80 ? "text-emerald-600" : recoupmentRate >= 50 ? "text-amber-600" : "text-red-600"
            )}>
              {recoupmentRate.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">Rate</p>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200/50 dark:border-slate-700/30 p-4 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="grid sm:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl">
              <p className="text-xs text-slate-500">Principal</p>
              <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(employer.total_amount, 'USD')}</p>
            </div>
            <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl">
              <p className="text-xs text-slate-500">Fees</p>
              <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(employer.total_fees, 'USD')}</p>
            </div>
            <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl">
              <p className="text-xs text-slate-500">Pending Recoupment</p>
              <p className="font-bold text-amber-600">{formatCurrency(employer.pending_recoupment, 'USD')}</p>
            </div>
            <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl">
              <p className="text-xs text-slate-500">Recouped</p>
              <p className="font-bold text-emerald-600">{formatCurrency(employer.recouped, 'USD')}</p>
            </div>
          </div>

          
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Recent Advances</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {employer.advances?.slice(0, 5).map((adv) => (
              <div key={adv.id} className="flex items-center justify-between p-2 bg-white/40 dark:bg-slate-900/30 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <code className="text-xs font-mono text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded">
                    {adv.reference}
                  </code>
                  <span className="text-slate-600 dark:text-slate-400">{adv.employee_name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(adv.amount, 'USD')}</span>
                  <StatusBadge status={adv.status === 'repaid' ? 'recouped' : 'pending'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ReconciliationData {
  summary: {
    total_employers: number;
    total_disbursed: number;
    total_fees: number;
    pending_recoupment: number;
    total_recouped: number;
  };
  by_employer: {
    employer_id: string;
    employer_name: string;
    total_advances: number;
    total_amount: number;
    total_fees: number;
    pending_recoupment: number;
    recouped: number;
    advances?: {
      id: string;
      reference: string;
      employee_name: string;
      amount: number;
      status: string;
    }[];
  }[];
}
export default function AdminReconciliation() {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEmployer, setExpandedEmployer] = useState<string | null>(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch('/api/admin/reconciliation');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch reconciliation data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleExport = () => {
    if (!data?.by_employer?.length) return;

    const rows = [
      ['Employer', 'Advances', 'Principal (USD)', 'Fees (USD)', 'Total Owed (USD)', 'Recouped (USD)', 'Pending (USD)', 'Rate (%)'],
    ];

    data.by_employer.forEach(e => {
      const total = e.total_amount + e.total_fees;
      const rate = total > 0 ? ((e.recouped / total) * 100).toFixed(1) : '0.0';
      rows.push([
        e.employer_name,
        String(e.total_advances),
        e.total_amount.toFixed(2),
        e.total_fees.toFixed(2),
        total.toFixed(2),
        e.recouped.toFixed(2),
        e.pending_recoupment.toFixed(2),
        rate,
      ]);
    });

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredEmployers = data?.by_employer?.filter((e) => 
    (e.employer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-14 h-14 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reconciliation</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Track advance recoupments and employer payments
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60" onClick={() => fetchData(true)} disabled={refreshing}>
              <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} /> Refresh
            </Button>
            <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60" onClick={handleExport} disabled={!data?.by_employer?.length}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard 
            icon={Building2}
            label="Total Employers"
            value={data?.summary?.total_employers || 0}
            variant="purple"
          />
          <SummaryCard 
            icon={DollarSign}
            label="Total Disbursed"
            value={formatCurrency(data?.summary?.total_disbursed || 0, 'USD')}
            subvalue={`Fees: ${formatCurrency(data?.summary?.total_fees || 0, 'USD')}`}
            variant="green"
          />
          <SummaryCard 
            icon={Clock}
            label="Pending Recoupment"
            value={formatCurrency(data?.summary?.pending_recoupment || 0, 'USD')}
            variant="amber"
          />
          <SummaryCard 
            icon={CheckCircle2}
            label="Total Recouped"
            value={formatCurrency(data?.summary?.total_recouped || 0, 'USD')}
            variant="green"
          />
        </div>

        
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-200/50 dark:border-purple-700/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-purple-900 dark:text-purple-100">Reference Tracking System</p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                Each advance has a unique reference (EWA-XXXXXXXX) that is cross-referenced on debit orders for month-end recoupment from employers. 
                Use these references to match payments received.
              </p>
            </div>
          </div>
        </div>

        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search employers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-11 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
          />
        </div>

        
        <div className="space-y-3">
          {filteredEmployers.map((employer) => (
            <EmployerReconRow 
              key={employer.employer_id}
              employer={employer}
              expanded={expandedEmployer === employer.employer_id}
              onExpand={() => setExpandedEmployer(
                expandedEmployer === employer.employer_id ? null : employer.employer_id
              )}
            />
          ))}
          {filteredEmployers.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No employers found matching &ldquo;{searchTerm}&rdquo;
            </div>
          )}
        </div>
      </div>
  );
}

