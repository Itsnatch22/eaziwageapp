"use client"
import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, FileText, CheckCircle2, AlertCircle,
  TrendingUp, Users, DollarSign, BarChart3, ChevronRight, Eye,
  CreditCard, Link2, RefreshCw, X, Copy, Check, XCircle, AlertTriangle,
  Plug, Info, Download, Wifi, ChevronDown, ChevronUp,
  TrendingDown, TableIcon, Wallet,
} from 'lucide-react';

// ── Payroll simulator currency formatting ─────────────────────────────────────
const SIM_CURRENCY_CONFIG = {
  KES: { locale: 'en-KE', decimals: 0 },
  UGX: { locale: 'en-UG', decimals: 0 },
  TZS: { locale: 'en-TZ', decimals: 0 },
  RWF: { locale: 'en-RW', decimals: 0 },
} as const;
function fmtSim(amount: number, currency: string): string {
  const cfg = SIM_CURRENCY_CONFIG[currency as keyof typeof SIM_CURRENCY_CONFIG]
    ?? { locale: 'en-KE', decimals: 0 };
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency', currency,
    maximumFractionDigits: cfg.decimals,
  }).format(amount);
}
function deductionColor(pct: number) {
  if (pct < 20) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
  if (pct <= 40) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
  return 'text-red-600 bg-red-50 dark:bg-red-900/20';
}
function exportSimulatorCSV(rows: SimAdvance[], simCurrency: string) {
  const header = ['Employee', 'Employee Code', 'Department', 'Monthly Salary', 'Total Advance', 'Net Pay', '% Deducted'];
  const lines = rows.map(r => [
    r.full_name ?? '',
    r.employee_code ?? '',
    r.department ?? '',
    r.monthly_salary,
    r.total_advance,
    r.monthly_salary - r.total_advance,
    ((r.total_advance / r.monthly_salary) * 100).toFixed(1) + '%',
  ].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-impact-${simCurrency}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

interface Employee {
  id: string;
  employer_id: string;
  full_name: string | null;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  monthly_salary: number | null;
  status: string;
}

interface Integration {
  id: string;
  provider: string;
  provider_label?: string;
  integration_code: string;
  sync_mode: 'auto' | 'manual';
  sync_frequency: string;
  sync_time: string;
  status: 'pending' | 'active' | 'error' | 'disconnected';
  last_sync_at: string | null;
  last_sync_status: 'success' | 'failed' | 'partial' | null;
  last_error: string | null;
  uptime?: number;
  latency_ms?: number;
  health_status?: 'healthy' | 'degraded' | 'down';
}

interface PayrollRecord {
  id: string;
  month: string;
  source: string;
  status: string;
  file_name?: string;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  total_gross: number;
  error_summary: { row: number; field: string; message: string }[];
  warning_summary: { row: number; field: string; message: string }[];
  uploaded_at: string;
  processed_at?: string;
  employees?: { employee_code: string; days_worked: number; gross_salary: number; row_status: string }[];
}

type SyncResultStatus = 'success' | 'partial' | 'failed' | 'no_data';

interface SyncEmployeeRow {
  employee_code: string;
  days_worked: number | null;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  row_status: 'valid' | 'invalid' | 'warning';
  row_errors: { field: string; message: string }[];
  row_warnings: { field: string; message: string }[];
}

interface SyncResult {
  message: string;
  status: SyncResultStatus;
  last_sync_at: string;
  month: string;
  provider: string;
  records_received: number;
  records_valid: number;
  records_failed: number;
  duration_ms: number;
  totals: {
    gross: number;
    net: number;
    deductions: number;
  };
  employees: SyncEmployeeRow[];
  error_summary?: { row: number; field: string; message: string }[];
  warning_summary?: { row: number; field: string; message: string }[];
}



interface SimAdvance {
  id: string;
  full_name: string | null;
  employee_code: string | null;
  department: string | null;
  monthly_salary: number;
  total_advance: number;
  advances: Array<{ id: string; amount: number; fee_amount: number | null; disbursed_at: string | null }>;
}

interface SimTotals {
  total_payroll: number;
  total_committed: number;
  net_payroll_outflow: number;
  employees_total: number;
  employees_affected: number;
  monthly_disbursed: number;
  monthly_fees: number;
  monthly_advance_count: number;
}

interface SimulatorData {
  currency: string;
  payroll_cycle: string | null;
  employees: SimAdvance[];
  totals: SimTotals;
}

const PROVIDERS = ['SAP', 'Oracle', 'Sage', 'QuickBooks', 'Workday', 'Paychex', 'BambooHR', 'Gusto', 'Custom'];
const FREQUENCIES = [
  { value: 'realtime', label: 'Real-time' },
  { value: 'hourly',   label: 'Hourly'    },
  { value: 'daily',    label: 'Daily'     },
  { value: 'weekly',   label: 'Weekly'    },
  { value: 'monthly',  label: 'Monthly'   },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}



interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  trendUp?: boolean;
}
const MetricCard = ({ icon: Icon, label, value, subtext, trend, trendUp }: MetricCardProps) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between mb-3">
      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
          trendUp ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600" : "bg-red-100 dark:bg-red-500/20 text-red-600"
        )}>
          <TrendingUp className={cn("w-3 h-3", !trendUp && "rotate-180")} />
          {trend}
        </div>
      )}
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    {subtext && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
  </div>
);

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      title="Copy"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
        : <Copy className="w-3.5 h-3.5 text-slate-400" />}
    </button>
  );
};



const SyncResultsPanel = ({
  result,
  currency,
  onDismiss,
}: {
  result: SyncResult;
  currency: string;
  onDismiss: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  const statusConfig: Record<SyncResultStatus, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    success: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle2, label: 'Sync complete' },
    partial: { bg: 'bg-amber-50 dark:bg-amber-500/10',   text: 'text-amber-700 dark:text-amber-300',   icon: AlertTriangle,  label: 'Sync partial'  },
    failed:  { bg: 'bg-red-50 dark:bg-red-500/10',       text: 'text-red-700 dark:text-red-300',       icon: XCircle,        label: 'Sync failed'   },
    no_data: { bg: 'bg-slate-50 dark:bg-slate-800/50',   text: 'text-slate-600 dark:text-slate-300',   icon: Info,           label: 'No data yet'   },
  };

  const cfg = statusConfig[result.status];
  const StatusIcon = cfg.icon;

  return (
    <div className={cn('rounded-2xl border p-5 mt-4', cfg.bg,
      result.status === 'success' ? 'border-emerald-200 dark:border-emerald-500/20' :
      result.status === 'partial' ? 'border-amber-200 dark:border-amber-500/20'     :
      result.status === 'failed'  ? 'border-red-200 dark:border-red-500/20'         :
      'border-slate-200 dark:border-slate-700/30'
    )}>

      
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusIcon className={cn('w-5 h-5 shrink-0', cfg.text)} />
          <div>
            <p className={cn('font-semibold text-sm', cfg.text)}>{cfg.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{result.message}</p>
          </div>
        </div>
        <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      
      {result.status !== 'no_data' && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Received</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{result.records_received}</p>
          </div>
          <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Valid</p>
            <p className="text-lg font-bold text-emerald-600">{result.records_valid}</p>
          </div>
          <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Failed</p>
            <p className={cn('text-lg font-bold', result.records_failed > 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500')}>
              {result.records_failed}
            </p>
          </div>
        </div>
      )}

      
      {result.status !== 'no_data' && result.totals && (
        <div className="grid grid-cols-3 gap-3 mt-3">
          {[
            { label: 'Gross',      value: result.totals.gross      },
            { label: 'Deductions', value: result.totals.deductions },
            { label: 'Net',        value: result.totals.net        },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(value, currency)}</p>
            </div>
          ))}
        </div>
      )}

      
      {result.employees && result.employees.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(p => !p)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide' : 'Show'} employee breakdown ({result.employees.length})
          </button>

          {expanded && (
            <div className="mt-3 rounded-xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/50 dark:border-slate-700/30">
                      {['Code', 'Days', 'Gross', 'Deductions', 'Net', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {result.employees.map((emp, i) => (
                      <tr key={i} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2 font-mono font-medium text-slate-900 dark:text-white">{emp.employee_code}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{emp.days_worked ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-900 dark:text-white">{formatCurrency(emp.gross_salary, currency)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{formatCurrency(emp.deductions, currency)}</td>
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{formatCurrency(emp.net_salary, currency)}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full font-semibold capitalize',
                            emp.row_status === 'valid'   ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                            emp.row_status === 'warning' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'         :
                                                           'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                          )}>
                            {emp.row_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              
              {result.error_summary && result.error_summary.length > 0 && (
                <div className="border-t border-slate-200/50 dark:border-slate-700/30 p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-600 mb-2">Validation errors</p>
                  {result.error_summary.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">
                      Row {e.row} · <span className="font-mono">{e.field}</span> — {e.message}
                    </p>
                  ))}
                </div>
              )}

              
              {result.warning_summary && result.warning_summary.length > 0 && (
                <div className="border-t border-slate-200/50 dark:border-slate-700/30 p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-600 mb-2">Warnings</p>
                  {result.warning_summary.map((w, i) => (
                    <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                      Row {w.row} · <span className="font-mono">{w.field}</span> — {w.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/5 dark:border-white/5">
        <p className="text-xs text-slate-400">{result.provider} · {result.month}</p>
        <p className="text-xs text-slate-400">{result.duration_ms}ms</p>
      </div>
    </div>
  );
};



const ConnectPayrollModal = ({ isOpen, onClose, onConnected, existingIntegration, onDelete }: {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (integration: Integration & { webhook_secret: string }) => void;
  existingIntegration?: Integration | null;
  onDelete?: () => void;
}) => {
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ integration_code: string; webhook_secret: string; provider: string; instructions: Record<string, string> } | null>(null);
  const [form, setForm] = useState({
    provider: '',
    provider_label: '',
    sync_mode: 'manual' as 'auto' | 'manual',
    sync_frequency: 'daily',
    sync_time: '00:00',
  });
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const handleConnect = async () => {
    if (!form.provider) { toast.error('Please select a provider'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/employer-dashboard/payroll/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to connect');
      setResult(data);
      setStep('code');
      onConnected({ ...form, ...data, status: 'pending', id: '', last_sync_at: null, last_sync_status: null, last_error: null });
      toast.success(`${form.provider} integration created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { setStep('form'); setResult(null); onClose(); };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-linear-to-r from-primary to-emerald-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Plug className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {existingIntegration ? 'Integration Details' : step === 'form' ? 'Connect Payroll System' : 'Integration Ready'}
              </h2>
              <p className="text-white/70 text-sm">
                {existingIntegration ? 'View your active connection' : step === 'form' ? 'Link your HR/payroll platform to EaziWage' : 'Share these credentials with your IT team'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {existingIntegration ? (
          <div className="p-6 space-y-6">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Credentials are Immutable</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  For security, integration keys cannot be edited. To change providers or refresh keys, delete this integration and create a fresh one.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">Provider</span>
                <span className="font-bold text-slate-900 dark:text-white">{existingIntegration.provider_label || existingIntegration.provider}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">Integration Code</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-primary font-bold tracking-widest">{existingIntegration.integration_code}</code>
                  <CopyButton text={existingIntegration.integration_code} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">Status</span>
                <span className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{existingIntegration.status}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">Sync Mode</span>
                <span className="text-sm font-semibold capitalize text-emerald-600">{existingIntegration.sync_mode}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">Sync Frequency</span>
                <span className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{existingIntegration.sync_frequency}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">Last Sync</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {existingIntegration.last_sync_at ? new Date(existingIntegration.last_sync_at).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">Close</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this integration? Sync will stop immediately.')) {
                    onDelete?.();
                    handleClose();
                  }
                }}
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" /> Delete Integration
              </Button>
            </div>
          </div>
        ) : step === 'form' ? (
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Payroll Provider *</Label>
              <Select value={form.provider} onValueChange={v => setForm(p => ({ ...p, provider: v }))}>
                <SelectTrigger className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Select your payroll system…" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Label <span className="text-slate-400">(optional)</span></Label>
              <Input
                placeholder="e.g. 'Main Payroll', 'Kenya Sage'"
                value={form.provider_label}
                onChange={e => setForm(p => ({ ...p, provider_label: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Sync Mode</Label>
              <Select value={form.sync_mode} onValueChange={v => setForm(p => ({ ...p, sync_mode: v as 'auto' | 'manual' }))}>
                <SelectTrigger className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto — process pushes from my payroll system immediately</SelectItem>
                  <SelectItem value="manual">Manual — I&apos;ll upload payroll files myself</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                {form.sync_mode === 'auto'
                  ? 'Your IT team pushes data to the webhook below and it lands on employee records automatically — no manual click needed.'
                  : "You'll upload payroll files from this page and trigger each sync yourself."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Frequency</Label>
                <Select value={form.sync_frequency} onValueChange={v => setForm(p => ({ ...p, sync_frequency: v }))}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Time (HH:MM)</Label>
                <Input
                  type="time"
                  value={form.sync_time}
                  onChange={e => setForm(p => ({ ...p, sync_time: e.target.value }))}
                  className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
              <Button onClick={handleConnect} disabled={saving || !form.provider} className="flex-1 bg-primary text-white">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
                {saving ? 'Connecting…' : 'Generate Integration Code'}
              </Button>
            </div>
          </div>
        ) : result && (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {result.provider} integration is ready. Share the credentials below with your IT administrator.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Integration Code</Label>
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <code className="flex-1 font-mono text-primary font-bold tracking-widest">{result.integration_code}</code>
                <CopyButton text={result.integration_code} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Webhook Secret <span className="text-amber-500">(keep private)</span></Label>
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                
                <code className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-300 truncate">{revealedSecret ?? '••••••••••••••••••••••••••••••'}</code>
                {!revealed && (
                  <Button
                    variant="outline"
                    disabled={revealing}
                    onClick={async () => {
                      try {
                        setRevealing(true);

                        const resp = await fetch('/api/employer-dashboard/payroll/reveal', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ integration_code: result.integration_code })
                        });
                        if (!resp.ok) throw new Error('Reveal failed');
                        const json = await resp.json();
                        setRevealedSecret(json.secret ?? null);
                        setRevealed(true);
                      } catch (err) {
                        console.error('Reveal failed', err);

                      } finally {
                        setRevealing(false);
                      }
                    }}
                  >
                    Reveal (audited)
                  </Button>
                )}
                {revealed && (
                  <CopyButton text={revealedSecret ?? ''} />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Push Endpoint</Label>
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <code className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-300 truncate">{result.instructions?.endpoint}</code>
                <CopyButton text={result.instructions?.endpoint ?? ''} />
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Important:</strong> These credentials are only shown once. Copy and store them securely now.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full bg-primary text-white">I have saved these</Button>
          </div>
        )}
      </div>
    </div>
  );
};



const PayrollHistoryItem = ({
  record,
  onView,
  currency = 'KES',
}: { record: PayrollRecord; onView: (r: PayrollRecord) => void; currency?: string }) => {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    processed: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Processed' },
    partial:   { bg: 'bg-amber-100 dark:bg-amber-500/20',   text: 'text-amber-700 dark:text-amber-300',   label: 'Partial'   },
    failed:    { bg: 'bg-red-100 dark:bg-red-500/20',       text: 'text-red-700 dark:text-red-300',       label: 'Failed'    },
    processing:{ bg: 'bg-blue-100 dark:bg-blue-500/20',     text: 'text-blue-700 dark:text-blue-300',     label: 'Processing'},
    pending:   { bg: 'bg-slate-100 dark:bg-slate-700',      text: 'text-slate-600 dark:text-slate-300',   label: 'Pending'   },
  };
  const s = statusConfig[record.status] ?? statusConfig.pending;

  return (
    <div className="flex items-center gap-4 p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors group">
      <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shadow-md shrink-0">
        <Calendar className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 dark:text-white">
          {new Date(record.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {record.processed_rows} / {record.total_rows} rows •{' '}
          {record.failed_rows > 0 && <span className="text-red-500">{record.failed_rows} failed • </span>}
          Uploaded {formatDateTime(record.uploaded_at)}
        </p>
      </div>
      <div className="text-right hidden sm:block">
        <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(record.total_gross ?? 0, currency)}</p>
        <p className="text-xs text-slate-400">Gross</p>
      </div>
      <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", s.bg, s.text)}>{s.label}</span>
      <button
        onClick={() => onView(record)}
        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Eye className="w-4 h-4" />
      </button>
    </div>
  );
};



export default function EmployerPayroll() {
  const { currency } = useCurrency();
  const [employer, setEmployer] = useState<{ id: string; company_name: string; full_name: string | null; country?: string; currency?: string } | null>(null);
  const [employees, setEmployees]             = useState<Employee[]>([]);
  const [payrollHistory, setPayrollHistory]   = useState<PayrollRecord[]>([]);
  const [integration, setIntegration]         = useState<Integration | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [syncing, setSyncing]                 = useState(false);
  const [selectedMonth, setSelectedMonth]     = useState(new Date().toISOString().slice(0, 7));
  const [showConnectModal, setShowConnectModal] = useState(false);


  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [simulator, setSimulator]   = useState<SimulatorData | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [showSim, setShowSim]       = useState(false);

  const fetchSimulator = useCallback(async () => {
    setSimLoading(true);
    try {
      const res = await fetch('/api/employer-dashboard/payroll-simulator');
      if (res.ok) setSimulator(await res.json() as SimulatorData);
    } catch { /* non-critical */ } finally { setSimLoading(false); }
  }, []);

  const fetchData = useCallback(async () => {
    await Promise.resolve();
    try {
      const [profileRes, employeesRes, historyRes, connectRes] = await Promise.all([
        fetch('/api/employer-dashboard/profile').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/employer-dashboard/employees').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/employer-dashboard/payroll/history').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/employer-dashboard/payroll/connect').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (profileRes?.profile) {
        setEmployer({
          id: profileRes.profile.id,
          company_name: profileRes.profile.company_name || profileRes.profile.full_name || 'Employer',
          full_name: profileRes.profile.full_name,
          country: profileRes.profile.country,
          currency: profileRes.profile.currency,
        });
      }
      setEmployees(employeesRes?.employees ?? []);
      setPayrollHistory(Array.isArray(historyRes) ? historyRes : []);

      const integrations = connectRes?.integrations ?? [];
      if (integrations.length > 0) {
        setIntegration(integrations[0]);
      }
    } catch (err) {
      console.error('Failed to fetch payroll data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchData());
    Promise.resolve().then(() => fetchSimulator());
  }, [fetchData, fetchSimulator]);

  const downloadTemplate = () => {
    const rows = [
      ['employee_code', 'days_worked', 'gross_salary', 'deductions'],
      ['EMP001', '22', '50000', '0'],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payroll-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPayrollDeductionFile = async () => {
    try {
      const params = new URLSearchParams({ month: selectedMonth });
      const res = await fetch(`/api/employer-dashboard/payroll/reconciliation-file?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `payroll-deductions-${selectedMonth}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Payroll deduction file downloaded');
    } catch (err) {
      console.error('Failed to download payroll deduction file:', err);
      toast.error('Failed to download payroll deduction file');
    }
  };


  const handleSync = async () => {
    if (!integration?.id) return;
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/employer-dashboard/payroll/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: integration.id }),
      });

      const data = await res.json() as SyncResult;

      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Sync failed');

      setSyncResult(data);

      if (data.status === 'success') {
        toast.success(`Sync complete — ${data.records_valid} records loaded`);
      } else if (data.status === 'partial') {
        toast.warning(`Sync complete with issues — ${data.records_failed} record(s) failed`);
      } else if (data.status === 'no_data') {
        toast.info('No data pushed yet — ask your IT admin to push payroll data first');
      } else {
        toast.error(`Sync failed: ${data.message}`);
      }

      setIntegration(prev => prev ? {
        ...prev,
        last_sync_at:     data.last_sync_at,
        last_sync_status: data.status === 'no_data' ? 'failed' : data.status,
        status:           data.status === 'failed' ? 'error' : 'active',
      } : prev);


      if (data.status !== 'no_data') {
        await fetchData();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteIntegration = async () => {
    if (!integration?.id) {
      setIntegration(null);
      return;
    }
    try {
      const res = await fetch(`/api/employer-dashboard/payroll/connect?id=${integration.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setIntegration(null);
      setSyncResult(null);
      toast.success('Integration removed successfully');
    } catch {
      toast.error('Failed to remove integration');
    }
  };


  const activeEmployeesList  = employees.filter(e => e.status === 'approved');
  const totalPayroll         = activeEmployeesList.reduce((s, e) => s + (e.monthly_salary || 0), 0);
  const activeEmployees      = activeEmployeesList.length;
  const lastUpload           = payrollHistory[0];
  // Real disbursed advances + fees for the current month — was previously a flat
  // 3.3%-of-payroll estimate with a hardcoded 4.5% fee rate, which disagreed with
  // the real per-advance data shown system-wide (admin billing/dashboard, and the
  // simulator table directly below this card).
  const monthlyAdvances      = simulator?.totals.monthly_disbursed ?? 0;
  const platformFees         = simulator?.totals.monthly_fees ?? 0;
  const monthlyDeductions    = monthlyAdvances + platformFees;
  const avgFeeRate           = monthlyAdvances > 0 ? (platformFees / monthlyAdvances) * 100 : 0;
  const apiConnectionStatus  = integration?.status === 'active';

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

        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="payroll-title">
              Payroll Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Upload and manage employee earnings data
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 h-10 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <Calendar className="w-4 h-4 text-primary" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none w-32"
              />
            </div>
            <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" /> Template
            </Button>
            <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60" onClick={downloadPayrollDeductionFile}>
              <FileText className="w-4 h-4 mr-2" /> Payroll Deduction File
            </Button>
            {!integration && (
              <Button onClick={() => setShowConnectModal(true)} className="bg-primary text-white">
                <Plug className="w-4 h-4 mr-2" /> Connect Payroll
              </Button>
            )}
          </div>
        </div>

        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={DollarSign} label="Monthly Payroll" value={formatCurrency(totalPayroll, currency)} subtext={`${activeEmployees} active employees`} trend="+8.2%" trendUp />
          <MetricCard icon={Users} label="Employees" value={employees.length} subtext={`${activeEmployees} eligible for EWA`} />
          <MetricCard
            icon={Calendar}
            label="Last Upload"
            value={lastUpload ? new Date(lastUpload.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Never'}
            subtext={lastUpload ? `${lastUpload.processed_rows} / ${lastUpload.total_rows} records` : 'No data uploaded'}
          />
          <MetricCard icon={BarChart3} label="Upload History" value={payrollHistory.length} subtext="Total payroll cycles" />
        </div>

        {/* ── Payroll Impact Simulator ───────────────────────────────────────── */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          {/* Header / toggle row */}
          <button
            type="button"
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
            onClick={() => {
              if (!showSim && !simulator) void fetchSimulator();
              setShowSim(v => !v);
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <TableIcon className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Payroll Impact Simulator</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {simulator
                    ? `${simulator.totals.employees_affected} employees · ${fmtSim(simulator.totals.total_committed, simulator.currency)} committed from next payroll`
                    : 'Preview advance deductions before payroll runs'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {simulator && simulator.totals.employees_affected > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                  <Wallet className="w-3 h-3" />
                  {((simulator.totals.total_committed / simulator.totals.total_payroll) * 100).toFixed(1)}% of payroll
                </span>
              )}
              {showSim ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {showSim && (
            <div className="border-t border-slate-100 dark:border-slate-800">
              {simLoading ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-400">Loading advance commitments…</p>
                </div>
              ) : !simulator ? (
                <div className="flex flex-col items-center py-12 gap-2 text-slate-400">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm">Could not load simulator data</p>
                  <Button variant="outline" size="sm" onClick={() => void fetchSimulator()}>Retry</Button>
                </div>
              ) : (
                <div className="p-5 space-y-5">
                  {/* Summary row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Payroll', value: fmtSim(simulator.totals.total_payroll, simulator.currency), icon: DollarSign, color: 'text-slate-600' },
                      { label: 'Advance Repayments', value: fmtSim(simulator.totals.total_committed, simulator.currency), icon: TrendingDown, color: 'text-amber-600' },
                      { label: 'Net Payroll Outflow', value: fmtSim(simulator.totals.net_payroll_outflow, simulator.currency), icon: TrendingUp, color: 'text-emerald-600' },
                      { label: 'Employees Affected', value: `${simulator.totals.employees_affected} of ${simulator.totals.employees_total}`, icon: Users, color: 'text-violet-600' },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`w-3.5 h-3.5 ${color}`} />
                          <p className="text-xs text-slate-500">{label}</p>
                        </div>
                        <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {simulator.totals.employees_affected === 0 ? (
                    <div className="flex flex-col items-center py-8 gap-2 text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No outstanding advances</p>
                      <p className="text-xs">All employees have been repaid or have no active advances.</p>
                    </div>
                  ) : (
                    <>
                      {/* Per-employee table */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                {['Employee', 'Department', 'Salary', 'Advance', 'Net Pay', '% Deducted'].map(h => (
                                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {simulator.employees
                                .filter(e => e.advances.length > 0)
                                .map(emp => {
                                  const deductPct = emp.monthly_salary > 0
                                    ? (emp.total_advance / emp.monthly_salary) * 100
                                    : 0;
                                  const netPay = emp.monthly_salary - emp.total_advance;
                                  return (
                                    <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                      <td className="px-4 py-3">
                                        <p className="font-medium text-slate-900 dark:text-white">{emp.full_name ?? '—'}</p>
                                        {emp.employee_code && <p className="text-xs text-slate-400">{emp.employee_code}</p>}
                                      </td>
                                      <td className="px-4 py-3 text-slate-500">{emp.department ?? '—'}</td>
                                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 tabular-nums font-medium">
                                        {fmtSim(emp.monthly_salary, simulator.currency)}
                                      </td>
                                      <td className="px-4 py-3 tabular-nums font-medium text-amber-600">
                                        {fmtSim(emp.total_advance, simulator.currency)}
                                        {emp.advances.length > 1 && (
                                          <span className="ml-1 text-xs text-slate-400">×{emp.advances.length}</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 tabular-nums font-semibold text-slate-900 dark:text-white">
                                        {fmtSim(netPay, simulator.currency)}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${deductionColor(deductPct)}`}>
                                          {deductPct.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-slate-400">
                          Only showing employees with active unredeemed advances. Others ({simulator.totals.employees_total - simulator.totals.employees_affected}) are unaffected.
                        </p>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/60 dark:bg-slate-800/60"
                            onClick={() => exportSimulatorCSV(
                              simulator.employees.filter(e => e.advances.length > 0),
                              simulator.currency
                            )}
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
                          </Button>
                          <Button
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                            onClick={downloadPayrollDeductionFile}
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5" /> Run Payroll
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">

          
          <div className={cn(
            "backdrop-blur-sm rounded-2xl p-6 border",
            apiConnectionStatus
              ? "bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-700/30"
              : integration?.status === 'error'
              ? "bg-red-50/60 dark:bg-red-900/20 border-red-200/50 dark:border-red-700/30"
              : "bg-amber-50/60 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-700/30"
          )}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  apiConnectionStatus             ? "bg-emerald-500/20" :
                  integration?.status === 'error' ? "bg-red-500/20"     : "bg-amber-500/20"
                )}>
                  <Wifi className={cn(
                    "w-6 h-6",
                    apiConnectionStatus             ? "text-emerald-600" :
                    integration?.status === 'error' ? "text-red-600"     : "text-amber-600"
                  )} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Payroll API Connection</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Live integration with your payroll system</p>
                </div>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2",
                apiConnectionStatus             ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                integration?.status === 'error' ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300"               :
                                                  "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
              )}>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  apiConnectionStatus             ? "bg-emerald-500 animate-pulse" :
                  integration?.status === 'error' ? "bg-red-500"                   : "bg-amber-500"
                )} />
                {apiConnectionStatus             ? 'Active'      :
                 integration?.status === 'error' ? 'Sync Error'  :
                 integration                     ? 'Pending'     : 'Not connected'}
              </div>
            </div>

            {integration ? (
              <div className="space-y-2">
                {integration.status === 'error' && integration.last_error && (
                  <div className="p-3 bg-red-100 dark:bg-red-500/20 rounded-xl border border-red-200 dark:border-red-500/30 mb-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 dark:text-red-300">{integration.last_error}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Last Sync</span>
                  <div className="flex items-center gap-2">
                    {integration.last_sync_status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    {integration.last_sync_status === 'partial' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    {integration.last_sync_status === 'failed'  && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                    <span className="font-medium text-slate-900 dark:text-white">
                      {integration.last_sync_at ? relativeTime(integration.last_sync_at) : 'Never'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Sync Frequency</span>
                  <span className="font-medium text-slate-900 dark:text-white capitalize">
                    {integration.sync_frequency === 'realtime' ? 'Real-time' : integration.sync_frequency}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Provider</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {integration.provider_label || integration.provider}
                    </span>
                    <code className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded font-mono">
                      {integration.integration_code}
                    </code>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="flex-1">
                    {syncing
                      ? <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin mr-1.5" />
                      : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowConnectModal(true)} className="flex-1">
                    <Info className="w-3.5 h-3.5 mr-1.5" />
                    Manage Connection
                  </Button>
                </div>

                
                {syncResult && (
                  <SyncResultsPanel
                    result={syncResult}
                    currency={currency}
                    onDismiss={() => setSyncResult(null)}
                  />
                )}
              </div>
            ) : (
              <div className="p-4 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  No payroll system connected. Connect your system and share the integration code with your IT administrator to start receiving payroll data.
                </p>
                <Button onClick={() => setShowConnectModal(true)} className="bg-primary text-white" size="sm">
                  <Plug className="w-4 h-4 mr-2" /> Connect Payroll System
                </Button>
              </div>
            )}
          </div>

          
          <div className="bg-linear-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Monthly EWA Deduction</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total deductions from employer to EaziWage</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-center p-6 bg-white/60 dark:bg-slate-800/30 rounded-xl">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total This Month</p>
                <p className="text-4xl font-bold text-primary">{formatCurrency(monthlyDeductions, currency)}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {simulator?.totals.monthly_advance_count ?? 0} advance{(simulator?.totals.monthly_advance_count ?? 0) === 1 ? '' : 's'} this month
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl text-center">
                  <p className="text-xs text-slate-500">Advance Principal</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(monthlyAdvances, currency)}</p>
                </div>
                <div className="p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl text-center">
                  <p className="text-xs text-slate-500">Platform Fees ({avgFeeRate.toFixed(1)}%)</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(platformFees, currency)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                {integration ? 'System Health & History' : 'Upload History'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {integration ? 'Monitor sync health and previous uploads' : 'Previous payroll uploads'}
              </p>
            </div>
            {integration && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">API Uptime</p>
                  <p className="text-sm font-mono font-bold text-emerald-500">{integration.uptime ?? 99.9}%</p>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block" />
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Latency</p>
                  <p className="text-sm font-mono font-bold text-slate-600 dark:text-slate-300">{integration.latency_ms ?? 124}ms</p>
                </div>
              </div>
            )}
          </div>

          {integration && (
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200/50 dark:border-slate-700/30">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Status',    value: integration.status.charAt(0).toUpperCase() + integration.status.slice(1), dot: integration.status === 'active'  },
                  { label: 'Last Sync', value: integration.last_sync_at ? formatDateTime(integration.last_sync_at) : 'Waiting…', dot: false },
                  { label: 'Sync Mode', value: integration.sync_mode.charAt(0).toUpperCase() + integration.sync_mode.slice(1), dot: false },
                  { label: 'Frequency', value: integration.sync_frequency === 'realtime' ? 'Real-time' : integration.sync_frequency, dot: false },
                ].map(({ label, value, dot }) => (
                  <div key={label} className="p-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-700/30">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                    <div className="flex items-center gap-2">
                      {dot && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payrollHistory.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">No payroll data yet</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {integration
                  ? 'Waiting for your IT administrator to push payroll data. Once received, press Sync Now to load it.'
                  : 'Connect a payroll system to get started.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30 p-4 space-y-2">
              {payrollHistory.map(record => (
                <PayrollHistoryItem key={record.id} record={record} onView={() => {}} currency={currency} />
              ))}
            </div>
          )}
        </div>

        
        {!integration && (
          <div className="bg-linear-to-r from-primary/10 to-emerald-500/10 dark:from-primary/20 dark:to-emerald-500/20 backdrop-blur-sm rounded-2xl p-6 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Automated Payroll Integration</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Connect your payroll system for automatic data sync. We support SAP, Oracle, Sage, QuickBooks, and more.
                  Your IT team receives a unique integration code and a push endpoint — no VPN or IP whitelisting needed.
                </p>
                <Button onClick={() => setShowConnectModal(true)} className="mt-4 bg-primary text-white">
                  <Plug className="w-4 h-4 mr-2" /> Connect Now <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConnectPayrollModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        existingIntegration={integration}
        onDelete={handleDeleteIntegration}
        onConnected={(intg) => {
          setIntegration(intg as Integration);
          setShowConnectModal(false);
        }}
      />
    </EmployerPortalLayout>
  );
}