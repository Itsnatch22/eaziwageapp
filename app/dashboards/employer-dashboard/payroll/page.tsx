"use client"
import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, FileText, CheckCircle2, AlertCircle,
  TrendingUp, Users, DollarSign, BarChart3, ChevronRight, Eye,
  CreditCard, Link2, RefreshCw, X, Copy, Check, XCircle, AlertTriangle,
  Plug, Info, Download, Wifi,
} from 'lucide-react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

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
  // Health Metrics
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────
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

// ── Copy-to-clipboard button ──────────────────────────────────────────────────
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

// ── Connect Payroll Modal ─────────────────────────────────────────────────────
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
    sync_mode: 'auto' as 'auto' | 'manual',
    sync_frequency: 'realtime',
    sync_time: '00:00',
  });

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

        {/* Header */}
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
                  For security, integration keys cannot be edited. To change providers or refresh keys, you must delete this integration and create a fresh one.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">Provider</span>
                <span className="font-bold text-slate-900 dark:text-white">{existingIntegration.provider_label ?? existingIntegration.provider}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">Integration Code</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-primary font-bold tracking-widest">{existingIntegration.integration_code}</code>
                  <CopyButton text={existingIntegration.integration_code} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">Sync Mode</span>
                <span className="text-sm font-semibold capitalize text-emerald-600">{existingIntegration.sync_mode}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">Close</Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (confirm('Are you sure you want to delete this integration? Automatic sync will stop immediately.')) {
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
            {/* Provider */}
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

            {/* Label */}
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Label <span className="text-slate-400">(optional)</span></Label>
              <Input
                placeholder="e.g. 'Main Payroll', 'Kenya Sage'"
                value={form.provider_label}
                onChange={e => setForm(p => ({ ...p, provider_label: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* Sync mode */}
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Sync Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['manual', 'auto'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, sync_mode: mode }))}
                    className={cn(
                      "p-3 rounded-xl border-2 text-sm font-medium transition-all text-left",
                      form.sync_mode === mode
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <p className="font-semibold capitalize">{mode}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {mode === 'auto' ? 'System pulls data on schedule' : 'Provider pushes data via webhook'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency + Time */}
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

            {/* Integration code */}
            <div className="space-y-1">
              <Label className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Integration Code</Label>
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <code className="flex-1 font-mono text-primary font-bold tracking-widest">{result.integration_code}</code>
                <CopyButton text={result.integration_code} />
              </div>
            </div>

            {/* Webhook secret */}
            <div className="space-y-1">
              <Label className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Webhook Secret <span className="text-amber-500">(keep private)</span></Label>
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <code className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-300 truncate">{result.webhook_secret}</code>
                <CopyButton text={result.webhook_secret} />
              </div>
            </div>

            {/* Endpoint */}
            <div className="space-y-1">
              <Label className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Push Endpoint</Label>
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <code className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-300 truncate">{result.instructions?.endpoint}</code>
                <CopyButton text={result.instructions?.endpoint ?? ''} />
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Important:</strong> These credentials are only shown once. Copy and store them securely now. You cannot edit or retrieve them later.
              </p>
            </div>

            <Button onClick={handleClose} className="w-full bg-primary text-white">I have saved these</Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Payroll History Item ──────────────────────────────────────────────────────
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

// ─── Main page ────────────────────────────────────────────────────────────────

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

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
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

      // Use the most recently updated integration
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

  useEffect(() => { fetchData(); }, [fetchData]);

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
      const filenameMatch = disposition.match(/filename=\"([^\"]+)\"/);
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

  // ── Manual sync ───────────────────────────────────────────────────────────
  const handleSync = async () => {
    if (!integration?.id) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/employer-dashboard/payroll/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: integration.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');

      if (data.status === 'success') {
        toast.success(`Sync complete — ${data.records_valid} records received`);
      } else if (data.status === 'partial') {
        toast.warning(`Sync partial — ${data.records_failed} records failed`);
      } else {
        toast.error(`Sync failed: ${data.error_message}`);
      }

      // Update local integration state with latest sync metadata + mock health
      setIntegration(prev => prev ? {
        ...prev,
        last_sync_at:     data.last_sync_at,
        last_sync_status: data.status,
        status:           data.status === 'failed' ? 'error' : 'active',
        uptime:           99.9,
        latency_ms:       Math.floor(Math.random() * 150) + 100,
        health_status:    'healthy',
      } : prev);

      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteIntegration = async () => {
    if (!integration?.id) {
        // Fallback for UI-only removal if ID is missing (e.g. just created)
        setIntegration(null);
        return;
    }
    try {
      const res = await fetch(`/api/employer-dashboard/payroll/connect?id=${integration.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setIntegration(null);
      toast.success('Integration removed successfully');
    } catch {
      toast.error('Failed to remove integration');
    }
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const activeEmployeesList  = employees.filter(e => e.status === 'approved');
  const totalPayroll         = activeEmployeesList.reduce((s, e) => s + (e.monthly_salary || 0), 0);
  const activeEmployees      = activeEmployeesList.length;
  const lastUpload           = payrollHistory[0];
  const monthlyAdvances      = Math.round(totalPayroll * 0.033);
  const avgFeeRate           = 4.5;
  const platformFees         = Math.round(monthlyAdvances * (avgFeeRate / 100));
  const monthlyDeductions    = monthlyAdvances + platformFees;
  const apiConnectionStatus  = integration?.status === 'active';

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <EmployerPortalLayout employer={employer}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployerPortalLayout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
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

        {/* Stats Grid */}
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

        {/* API Connection + Monthly Deduction */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── API Connection Card ───────────────────────────────────────── */}
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
                  apiConnectionStatus        ? "bg-emerald-500/20" :
                  integration?.status === 'error' ? "bg-red-500/20"   : "bg-amber-500/20"
                )}>
                  <Wifi className={cn(
                    "w-6 h-6",
                    apiConnectionStatus        ? "text-emerald-600" :
                    integration?.status === 'error' ? "text-red-600"   : "text-amber-600"
                  )} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Payroll API Connection</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Live integration with your payroll system</p>
                </div>
              </div>

              <div className={cn(
                "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2",
                apiConnectionStatus        ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                integration?.status === 'error' ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300"         :
                                            "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
              )}>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  apiConnectionStatus        ? "bg-emerald-500 animate-pulse" :
                  integration?.status === 'error' ? "bg-red-500"             : "bg-amber-500"
                )} />
                {apiConnectionStatus        ? 'Auto Mode'   :
                 integration?.status === 'error' ? 'Sync Error'  :
                 integration              ? 'Pending'      : 'Manual Mode'}
              </div>
            </div>

            {integration ? (
              <div className="space-y-2">
                {/* Error banner */}
                {integration.status === 'error' && integration.last_error && (
                  <div className="p-3 bg-red-100 dark:bg-red-500/20 rounded-xl border border-red-200 dark:border-red-500/30 mb-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 dark:text-red-300">{integration.last_error}</p>
                    </div>
                  </div>
                )}

                {/* Last sync */}
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

                {/* Sync frequency */}
                <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Sync Frequency</span>
                  <span className="font-medium text-slate-900 dark:text-white capitalize">
                    {integration.sync_frequency === 'realtime' ? 'Real-time' : integration.sync_frequency}
                  </span>
                </div>

                {/* Provider */}
                <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Provider</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {integration.provider_label ?? integration.provider}
                    </span>
                    <code className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded font-mono">
                      {integration.integration_code}
                    </code>
                  </div>
                </div>

                {/* Action row */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex-1"
                  >
                    {syncing
                      ? <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin mr-1.5" />
                      : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowConnectModal(true)}
                    className="flex-1"
                  >
                    <Info className="w-3.5 h-3.5 mr-1.5" />
                    Manage Connection
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Manual upload mode is active. Connect your payroll system for automatic data sync.
                  We support SAP, Oracle, Sage, QuickBooks, and more.
                </p>
                <Button
                  onClick={() => setShowConnectModal(true)}
                  className="bg-primary text-white"
                  size="sm"
                >
                  <Plug className="w-4 h-4 mr-2" /> Connect Payroll System
                </Button>
              </div>
            )}
          </div>

          {/* ── Monthly EWA Deduction ────────────────────────────────────── */}
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
                <p className="text-xs text-slate-400 mt-1">On behalf of {activeEmployees} employees</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl text-center">
                  <p className="text-xs text-slate-500">Advance Principal</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(monthlyAdvances, currency)}</p>
                </div>
                <div className="p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl text-center">
                  <p className="text-xs text-slate-500">Platform Fees ({avgFeeRate}%)</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(platformFees, currency)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section 
        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── Upload Card ───────────────────────────────────────────────── *
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Upload Payroll Data</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Upload CSV or Excel file with employee earnings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Payroll Month</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                selectedFile ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700 hover:border-primary"
              )}>
                <input type="file" accept=".csv,.xlsx" onChange={handleFileSelect} className="hidden" id="payroll-file" />
                <label htmlFor="payroll-file" className="cursor-pointer">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  {selectedFile ? (
                    <>
                      <p className="font-semibold text-primary">{selectedFile.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Click to change
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900 dark:text-white">Click to upload file</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">CSV or Excel files • Max 10 MB</p>
                    </>
                  )}
                </label>
              </div>

              {/* Upload result banner - sits right above the button 
              {uploadResult && (
                <UploadResultBanner result={uploadResult} onDismiss={() => setUploadResult(null)} currency={currency} />
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full bg-primary text-white"
                data-testid="upload-payroll-btn"
              >
                {uploading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Processing…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Upload Payroll</>
                )}
              </Button>
            </div>
          </div>

          {/* ── Upload Process Steps ──────────────────────────────────────── *
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <h2 className="font-bold text-slate-900 dark:text-white mb-6">Upload Process</h2>
            <div className="space-y-4">
              <UploadStepCard
                step={1}
                title="Download Template"
                description="Get the CSV template with required columns"
                icon={Download}
                completed={true}
              />
              <UploadStepCard
                step={2}
                title="Fill Employee Data"
                description="Add employee codes, days worked, and salaries"
                icon={FileText}
                completed={!!selectedFile && !uploadFailed}
                active={!selectedFile && !uploadResult}
                error={uploadFailed}
              />
              <UploadStepCard
                step={3}
                title="Upload File"
                description="Upload the completed payroll file for validation"
                icon={Upload}
                completed={uploadDone || uploadPartial}
                active={!!selectedFile && !uploadResult && !uploading}
                warning={uploadPartial}
                error={uploadFailed}
              />
              <UploadStepCard
                step={4}
                title="Processing & Validation"
                description={
                  uploading         ? "Validating rows and computing totals…" :
                  uploadDone        ? `All ${uploadResult?.processed_rows} rows validated and processed` :
                  uploadPartial     ? `${uploadResult?.processed_rows} rows OK · ${uploadResult?.failed_rows} rows failed` :
                  uploadFailed      ? `All ${uploadResult?.total_rows} rows rejected — fix errors and re-upload` :
                  hasWarnings       ? `Processed with ${uploadResult?.warning_summary?.length} warnings` :
                                      "System validates and processes data"
                }
                icon={Clock}
                completed={uploadDone}
                active={uploading}
                warning={uploadPartial || (!!uploadResult && hasWarnings && !uploadFailed)}
                error={uploadFailed}
              />
            </div>

            {/* Info Banner *
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Required Columns</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300/80 mt-1">
                    <code>employee_code</code>, <code>days_worked</code>, <code>gross_salary</code>, <code>deductions</code> (optional)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        */}

        {/* Payroll History / System Health */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                {integration ? 'System Health & History' : 'Upload History'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {integration ? 'Monitor API health and previous syncs' : 'Previous payroll uploads'}
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
                <div className="p-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-700/30">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Operational</span>
                  </div>
                </div>
                <div className="p-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-700/30">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Sync</p>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {integration.last_sync_at ? formatDateTime(integration.last_sync_at) : 'Waiting...'}
                  </span>
                </div>
                <div className="p-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-700/30">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sync Mode</p>
                  <span className="text-sm font-bold text-primary">Auto</span>
                </div>
                <div className="p-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-700/30">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Frequency</p>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Real-time</span>
                </div>
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
                {integration ? 'System is waiting for the first automatic sync' : 'Upload your first payroll file to get started'}
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

        {/* Bottom integration info — only shown when no integration linked */}
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

      {/* Connect Payroll Modal */}
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
