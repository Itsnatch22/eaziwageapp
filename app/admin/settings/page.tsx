'use client'
import React, { useState, useEffect, useImperativeHandle, useRef, useCallback } from 'react';
import Image from 'next/image';
import { 
  Settings, Building2, Users, Sliders, Bell, Shield, 
  Save, RefreshCw, Search, Percent, Clock, DollarSign, AlertTriangle,
  CheckCircle2,  Edit, Lock, 
  Globe, Mail, Smartphone, FileText,
  TrendingUp, Zap, UserCheck,
  Plus, Trash2, X, History, FileCheck, BookOpen, CalendarOff, 
  ClipboardList, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AvatarUpload } from '@/components/ui/AvatarUpload';

interface GlobalSettings {
  default_advance_percent?: number;
  min_advance_amount?: number;
  max_advance_amount?: number;
  daily_advance_limit?: number;
  min_processing_fee?: number;
  max_processing_fee?: number;
  mobile_fee?: number;
  bank_fee?: number;
  default_cooldown_days?: number;
  weekly_advance_limit?: number;
  monthly_advance_limit?: number;
  new_employee_wait_days?: number;
  instant_mobile_enabled?: boolean;
  bank_transfers_enabled?: boolean;
  auto_approval_enabled?: boolean;
  weekend_advances_enabled?: boolean;
  enabled_countries?: string[];
}

interface RiskSettings {
  employer_low_threshold?: number;
  employer_medium_threshold?: number;
  employee_low_threshold?: number;
  employee_medium_threshold?: number;
  auto_suspend_threshold?: number;
  reduce_limits_threshold?: number;
  auto_suspend_on_fraud?: boolean;
  auto_reduce_on_warning?: boolean;
  notify_on_high_risk?: boolean;
  require_id_verification?: boolean;
  require_face_id?: boolean;
  require_address_proof?: boolean;
  require_employment_contract?: boolean;
  reverification_frequency?: 'monthly' | 'quarterly' | 'biannually' | 'annually' | 'never';
}

interface NotificationSettings {
  email_new_employer?: boolean;
  email_large_advance?: boolean;
  email_fraud_alert?: boolean;
  email_daily_summary?: boolean;
  email_weekly_report?: boolean;
  sms_fraud_alert?: boolean;
  sms_system_alert?: boolean;
  sms_large_transaction?: boolean;
  large_advance_threshold?: number;
  daily_volume_threshold?: number;
  fraud_alert_emails?: string;
  admin_sms_numbers?: string;
}

interface Employer {
  id: string;
  company_name: string;
  employee_count?: number;
  status: 'approved' | 'suspended' | 'pending';
  country?: string;
  risk_score?: number;
}

interface EmployerSettings {
  advance_limit_percent?: number;
  cooldown_days?: number;
  processing_fee?: number;
  max_monthly_advances?: number;
  employee_advance_limit_min?: number;
  employee_advance_limit_max?: number;
  employee_cooldown_min?: number;
  employee_cooldown_max?: number;
  funding_model?: 'prefunded' | 'debit_order' | 'invoice';
  risk_tier?: 'low' | 'medium' | 'high';
  funding_buffer_percent?: number;
  credit_limit?: number;
  ewa_enabled?: boolean;
  instant_enabled?: boolean;
  auto_approve?: boolean;
  weekend_access?: boolean;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
  employer_name?: string;
  risk_level?: 'low' | 'medium' | 'high';
  risk_score?: number;
}

interface EmployeeSettings {
  use_custom_settings?: boolean;
  advance_limit_percent?: number;
  cooldown_days?: number;
  max_monthly_advances?: number;
  fee_rate?: number;
  ewa_enabled?: boolean;
  vip_status?: boolean;
  manual_approval?: boolean;
  on_watchlist?: boolean;
  admin_notes?: string;
}

interface EmployeeStats {
  total_advances?: number;
  repayment_rate?: number;
}

interface Blackout {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  applies_to: string;
  reason?: string;
  is_active: boolean;
}

interface LegalDocument {
  id?: string;
  document_type: 'employee_terms' | 'employer_partnership' | 'privacy_policy';
  title: string;
  content: string;
  version: string;
  effective_date: string;
  is_active?: boolean;
}

interface DocumentType {
  type: 'employee_terms' | 'employer_partnership' | 'privacy_policy';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AuditLog {
  id: string;
  type: 'platform_settings' | 'risk_settings' | 'notification_settings' | 'employer_settings' | 'employee_settings' | 'legal_document' | 'blackout';
  description?: string;
  changed_by_name?: string;
  changed_at: string;
  employer_name?: string;
  employee_name?: string;
}

interface AuditStats {
  total_changes: number;
  by_type?: Record<string, number>;
  by_admin?: Array<{
    admin_id: string;
    name: string;
    count: number;
  }>;
}

interface AdminUser {
  id: string;
  name: string;
}

interface SecurityLog {
  action: string;
  created_at: string;
  metadata?: {
    ip?: string;
  };
}

interface AuditFilters {
  auditType: string;
  settingsType: string;
  changedBy: string;
  startDate: string;
  endDate: string;
}

interface Pagination {
  skip: number;
  limit: number;
  total: number;
}

type TabId = 'global' | 'employer' | 'employee' | 'risk' | 'notifications' | 'blackouts' | 'legal' | 'audit' | 'security';

interface SettingsSaveHandle {
  save: () => Promise<void>;
}


interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: number;
  helpText?: string;
  disabled?: boolean;
}

const RangeSlider: React.FC<RangeSliderProps> = ({ 
  label, 
  min, 
  max, 
  value, 
  onChange, 
  unit = '', 
  step = 1, 
  helpText, 
  disabled = false 
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-sm font-medium">{label}</Label>
      <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
        {value}{unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
    />
    <div className="flex justify-between text-xs text-slate-500">
      <span>{min}{unit}</span>
      <span>{max}{unit}</span>
    </div>
    {helpText && <p className="text-xs text-slate-500 dark:text-slate-400">{helpText}</p>}
  </div>
);

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ 
  enabled, 
  onChange, 
  label, 
  description, 
  disabled = false 
}) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
    <div>
      <p className="font-medium text-slate-900 dark:text-white">{label}</p>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
        enabled ? 'translate-x-5.5' : 'translate-x-0.5'
      }`} />
    </button>
  </div>
);

interface SectionCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  description?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({ 
  title, 
  icon: Icon, 
  children, 
  description 
}) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-linear-to-r from-purple-500/5 to-violet-500/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

interface GlobalSettingsTabProps {
  settings: GlobalSettings;
  onUpdate: (updatedSettings: GlobalSettings) => void;
  loading: boolean;
}

const GlobalSettingsTab: React.FC<GlobalSettingsTabProps> = ({ 
  settings, 
  onUpdate, 
  loading 
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <SectionCard title="EWA Advance Limits" icon={Percent} description="Default limits for all employers and employees">
        <div className="grid md:grid-cols-2 gap-6">
          <RangeSlider
            label="Default Advance Percentage"
            min={10}
            max={80}
            value={settings.default_advance_percent || 60}
            onChange={(v) => onUpdate({ ...settings, default_advance_percent: v })}
            unit="%"
            helpText="Maximum % of earned wages employees can access"
          />
          <RangeSlider
            label="Minimum Advance Amount"
            min={100}
            max={5000}
            value={settings.min_advance_amount || 500}
            onChange={(v) => onUpdate({ ...settings, min_advance_amount: v })}
            unit=" KES"
            step={100}
            helpText="Minimum amount per advance request"
          />
          <RangeSlider
            label="Maximum Advance Amount"
            min={10000}
            max={500000}
            value={settings.max_advance_amount || 100000}
            onChange={(v) => onUpdate({ ...settings, max_advance_amount: v })}
            unit=" KES"
            step={5000}
            helpText="Maximum amount per advance request"
          />
          <RangeSlider
            label="Daily Advance Limit"
            min={1}
            max={10}
            value={settings.daily_advance_limit || 3}
            onChange={(v) => onUpdate({ ...settings, daily_advance_limit: v })}
            unit=" requests"
            helpText="Maximum advances per employee per day"
          />
        </div>
      </SectionCard>

      
      <SectionCard title="Fee Structure" icon={DollarSign} description="Platform-wide fee configuration">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900 dark:text-white">Processing Fee Range</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Minimum Fee</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.min_processing_fee || 3.5}
                    onChange={(e) => onUpdate({ ...settings, min_processing_fee: parseFloat(e.target.value) })}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </div>
              </div>
              <div>
                <Label className="text-sm">Maximum Fee</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.max_processing_fee || 6.0}
                    onChange={(e) => onUpdate({ ...settings, max_processing_fee: parseFloat(e.target.value) })}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">Processing fee charged per advance (risk-based)</p>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900 dark:text-white">Transaction Fees</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Mobile Money Fee</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.5"
                    value={settings.mobile_fee || 50}
                    onChange={(e) => onUpdate({ ...settings, mobile_fee: parseFloat(e.target.value) })}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">KES</span>
                </div>
              </div>
              <div>
                <Label className="text-sm">Bank Transfer Fee</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.5"
                    value={settings.bank_fee || 100}
                    onChange={(e) => onUpdate({ ...settings, bank_fee: parseFloat(e.target.value) })}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">KES</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      
      <SectionCard title="Cooldown & Frequency" icon={Clock} description="Time-based restrictions">
        <div className="grid md:grid-cols-2 gap-6">
          <RangeSlider
            label="Default Cooldown Period"
            min={0}
            max={14}
            value={settings.default_cooldown_days || 3}
            onChange={(v) => onUpdate({ ...settings, default_cooldown_days: v })}
            unit=" days"
            helpText="Wait time between advance requests"
          />
          <RangeSlider
            label="Weekly Advance Limit"
            min={1}
            max={20}
            value={settings.weekly_advance_limit || 5}
            onChange={(v) => onUpdate({ ...settings, weekly_advance_limit: v })}
            unit=" requests"
            helpText="Maximum advances per employee per week"
          />
          <RangeSlider
            label="Monthly Advance Limit"
            min={1}
            max={50}
            value={settings.monthly_advance_limit || 15}
            onChange={(v) => onUpdate({ ...settings, monthly_advance_limit: v })}
            unit=" requests"
            helpText="Maximum advances per employee per month"
          />
          <RangeSlider
            label="New Employee Waiting Period"
            min={0}
            max={90}
            value={settings.new_employee_wait_days || 30}
            onChange={(v) => onUpdate({ ...settings, new_employee_wait_days: v })}
            unit=" days"
            helpText="Days before new employees can request advances"
          />
        </div>
      </SectionCard>

      
      <SectionCard title="Platform Features" icon={Settings} description="Enable or disable platform features">
        <div className="space-y-3">
          <Toggle
            label="Instant Mobile Money Transfers"
            description="Enable real-time M-Pesa/Airtel Money disbursements"
            enabled={settings.instant_mobile_enabled ?? true}
            onChange={(v) => onUpdate({ ...settings, instant_mobile_enabled: v })}
          />
          <Toggle
            label="Bank Transfers"
            description="Allow advances to bank accounts"
            enabled={settings.bank_transfers_enabled ?? true}
            onChange={(v) => onUpdate({ ...settings, bank_transfers_enabled: v })}
          />
          <Toggle
            label="Auto-Approval for Low Risk"
            description="Automatically approve advances for low-risk employees"
            enabled={settings.auto_approval_enabled ?? true}
            onChange={(v) => onUpdate({ ...settings, auto_approval_enabled: v })}
          />
          <Toggle
            label="Weekend Advances"
            description="Allow advance requests on weekends"
            enabled={settings.weekend_advances_enabled ?? false}
            onChange={(v) => onUpdate({ ...settings, weekend_advances_enabled: v })}
          />
        </div>
      </SectionCard>

      
      <SectionCard title="Enabled Countries" icon={Globe} description="Countries where EWA service is available">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
            { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
            { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
            { code: 'RW', name: 'Rwanda', flag: '🇷🇼' }
          ].map((country) => {
            const isEnabled = (settings.enabled_countries || ['KE', 'UG', 'TZ', 'RW']).includes(country.code);
            return (
              <button
                key={country.code}
                onClick={() => {
                  const current = settings.enabled_countries || ['KE', 'UG', 'TZ', 'RW'];
                  const updated = isEnabled 
                    ? current.filter((c) => c !== country.code)
                    : [...current, country.code];
                  onUpdate({ ...settings, enabled_countries: updated });
                }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isEnabled 
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10' 
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                }`}
              >
                <span className="text-2xl">{country.flag}</span>
                <p className="font-medium text-slate-900 dark:text-white mt-2">{country.name}</p>
                <p className="text-xs text-slate-500">{country.code}</p>
              </button>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
};

interface EmployerConfigTabProps {
  token: string | null;
  onSave: () => void;
  onSaveAvailabilityChange: (canSave: boolean) => void;
}

const EmployerConfigTab = React.forwardRef<SettingsSaveHandle, EmployerConfigTabProps>(({ token, onSave, onSaveAvailabilityChange }, ref) => {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);
  const [employerSettings, setEmployerSettings] = useState<EmployerSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [, setSaving] = useState<boolean>(false);

  const fetchEmployers = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/settings/employers`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployers(data);
      }
    } catch {
      console.error('Error fetching employers:');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchEmployers();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchEmployers]);

  useEffect(() => {
    onSaveAvailabilityChange(Boolean(selectedEmployer && employerSettings));
  }, [employerSettings, onSaveAvailabilityChange, selectedEmployer]);

  const selectEmployer = async (employer: Employer) => {
    setSelectedEmployer(employer);
    try {
      const response = await fetch(`/api/admin/settings/employers/${employer.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setEmployerSettings(data.settings);
      }
    } catch {
      console.error('Error fetching employer settings:');
    }
  };

  const saveEmployerSettings = async () => {
    if (!selectedEmployer || !employerSettings) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/settings/employers/${selectedEmployer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(employerSettings)
      });
      if (response.ok) {
        toast.success('Employer settings saved successfully');
        onSave();
      } else {
        toast.error('Failed to save employer settings');
      }
    } catch {
      toast.error('Error saving employer settings');
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: saveEmployerSettings,
  }));

  const filteredEmployers = employers.filter(emp => 
    emp.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      
      <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-3">Select Employer</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search employers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="max-h-125 overflow-y-auto">
          {filteredEmployers.map((employer) => (
            <button
              key={employer.id}
              onClick={() => selectEmployer(employer)}
              className={`w-full p-4 text-left border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                selectedEmployer?.id === employer.id ? 'bg-purple-50 dark:bg-purple-500/10 border-l-4 border-l-purple-500' : ''
              }`}
              data-testid={`employer-${employer.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center text-white font-bold">
                  {employer.company_name?.charAt(0) || 'E'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">{employer.company_name}</p>
                  <p className="text-xs text-slate-500">{employer.employee_count || 0} employees</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  employer.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                  employer.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                }`}>
                  {employer.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      
      <div className="lg:col-span-2 space-y-6">
        {selectedEmployer && employerSettings ? (
          <>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-linear-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                    {selectedEmployer.company_name?.charAt(0) || 'E'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedEmployer.company_name}</h2>
                    <p className="text-slate-500">{selectedEmployer.employee_count || 0} employees • {selectedEmployer.country}</p>
                  </div>
                </div>
              </div>

              
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{employerSettings.advance_limit_percent || 60}%</p>
                  <p className="text-xs text-slate-500">Advance Limit</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{employerSettings.cooldown_days || 3}d</p>
                  <p className="text-xs text-slate-500">Cooldown</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{employerSettings.processing_fee || 4.5}%</p>
                  <p className="text-xs text-slate-500">Fee Rate</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedEmployer.risk_score?.toFixed(1) || 'N/A'}</p>
                  <p className="text-xs text-slate-500">Risk Score</p>
                </div>
              </div>
            </div>

            
            <SectionCard title="EWA Configuration" icon={Sliders} description="Custom settings for this employer">
              <div className="grid md:grid-cols-2 gap-6">
                <RangeSlider
                  label="Advance Percentage Limit"
                  min={10}
                  max={80}
                  value={employerSettings.advance_limit_percent || 60}
                  onChange={(v) => setEmployerSettings({ ...employerSettings, advance_limit_percent: v })}
                  unit="%"
                />
                <RangeSlider
                  label="Cooldown Period"
                  min={0}
                  max={14}
                  value={employerSettings.cooldown_days || 3}
                  onChange={(v) => setEmployerSettings({ ...employerSettings, cooldown_days: v })}
                  unit=" days"
                />
                <RangeSlider
                  label="Processing Fee"
                  min={2}
                  max={8}
                  step={0.5}
                  value={employerSettings.processing_fee || 4.5}
                  onChange={(v) => setEmployerSettings({ ...employerSettings, processing_fee: v })}
                  unit="%"
                />
                <RangeSlider
                  label="Max Monthly Advances"
                  min={1}
                  max={30}
                  value={employerSettings.max_monthly_advances || 10}
                  onChange={(v) => setEmployerSettings({ ...employerSettings, max_monthly_advances: v })}
                  unit=" requests"
                />
              </div>
            </SectionCard>

            
            <SectionCard title="Employee Limit Constraints" icon={Users} description="Limits this employer can set on their employees">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white">Advance Limit Range</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Min %</Label>
                      <Input
                        type="number"
                        value={employerSettings.employee_advance_limit_min || 10}
                        onChange={(e) => setEmployerSettings({ ...employerSettings, employee_advance_limit_min: parseFloat(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Max %</Label>
                      <Input
                        type="number"
                        value={employerSettings.employee_advance_limit_max || 60}
                        onChange={(e) => setEmployerSettings({ ...employerSettings, employee_advance_limit_max: parseFloat(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Range within which employer can adjust employee limits</p>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white">Cooldown Range</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Min Days</Label>
                      <Input
                        type="number"
                        value={employerSettings.employee_cooldown_min || 1}
                        onChange={(e) => setEmployerSettings({ ...employerSettings, employee_cooldown_min: parseInt(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Max Days</Label>
                      <Input
                        type="number"
                        value={employerSettings.employee_cooldown_max || 14}
                        onChange={(e) => setEmployerSettings({ ...employerSettings, employee_cooldown_max: parseInt(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            
            <SectionCard title="Funding & Risk Settings" icon={Shield} description="Financial controls">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Funding Model</Label>
                    <select
                      value={employerSettings.funding_model || 'prefunded'}
                      onChange={(e) => setEmployerSettings({ ...employerSettings, funding_model: e.target.value as EmployerSettings['funding_model'] })}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    >
                      <option value="prefunded">Prefunded Wallet</option>
                      <option value="debit_order">Debit Order</option>
                      <option value="invoice">Monthly Invoice</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Risk Tier</Label>
                    <select
                      value={employerSettings.risk_tier || 'low'}
                      onChange={(e) => setEmployerSettings({ ...employerSettings, risk_tier: e.target.value as EmployerSettings['risk_tier'] })}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    >
                      <option value="low">Low Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="high">High Risk</option>
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Funding Buffer Required</Label>
                    <div className="relative mt-1">
                      <Input
                        type="number"
                        value={employerSettings.funding_buffer_percent || 20}
                        onChange={(e) => setEmployerSettings({ ...employerSettings, funding_buffer_percent: parseInt(e.target.value) })}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Credit Limit (KES)</Label>
                    <Input
                      type="number"
                      value={employerSettings.credit_limit || 5000000}
                      onChange={(e) => setEmployerSettings({ ...employerSettings, credit_limit: parseInt(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            
            <SectionCard title="Feature Access" icon={Lock} description="Enable/disable features for this employer">
              <div className="space-y-3">
                <Toggle
                  label="EWA Service Active"
                  description="Master switch for EWA access"
                  enabled={employerSettings.ewa_enabled ?? true}
                  onChange={(v) => setEmployerSettings({ ...employerSettings, ewa_enabled: v })}
                />
                <Toggle
                  label="Allow Instant Transfers"
                  description="Real-time mobile money disbursements"
                  enabled={employerSettings.instant_enabled ?? true}
                  onChange={(v) => setEmployerSettings({ ...employerSettings, instant_enabled: v })}
                />
                <Toggle
                  label="Auto-Approve Low Risk Employees"
                  description="Skip manual review for low-risk advances"
                  enabled={employerSettings.auto_approve ?? true}
                  onChange={(v) => setEmployerSettings({ ...employerSettings, auto_approve: v })}
                />
                <Toggle
                  label="Weekend Access"
                  description="Allow advances on weekends"
                  enabled={employerSettings.weekend_access ?? false}
                  onChange={(v) => setEmployerSettings({ ...employerSettings, weekend_access: v })}
                />
              </div>
            </SectionCard>
          </>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Select an Employer</h3>
            <p className="text-slate-500">Choose an employer from the list to configure their EWA settings</p>
          </div>
        )}
      </div>
    </div>
  );
});

EmployerConfigTab.displayName = 'EmployerConfigTab';

interface EmployeeConfigTabProps {
  token: string | null;
  onSave: () => void;
  onSaveAvailabilityChange: (canSave: boolean) => void;
}

const EmployeeConfigTab = React.forwardRef<SettingsSaveHandle, EmployeeConfigTabProps>(({ token, onSave, onSaveAvailabilityChange }, ref) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeSettings | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(null);
  const [employerSettings, setEmployerSettings] = useState<EmployerSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [, setSaving] = useState<boolean>(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/settings/employees`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch {
      console.error('Error fetching employees:');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchEmployees();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchEmployees]);

  useEffect(() => {
    onSaveAvailabilityChange(Boolean(selectedEmployee && employeeSettings));
  }, [employeeSettings, onSaveAvailabilityChange, selectedEmployee]);

  const selectEmployee = async (employee: Employee) => {
    setSelectedEmployee(employee);
    try {
      const response = await fetch(`/api/admin/settings/employees/${employee.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setEmployeeSettings(data.settings);
        setEmployeeStats(data.stats);
        setEmployerSettings(data.employer_settings);
      }
    } catch {
      console.error('Error fetching employee settings:');
    }
  };

  const saveEmployeeSettings = async () => {
    if (!selectedEmployee || !employeeSettings) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/settings/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(employeeSettings)
      });
      if (response.ok) {
        toast.success('Employee settings saved successfully');
        onSave();
      } else {
        toast.error('Failed to save employee settings');
      }
    } catch {
      toast.error('Error saving employee settings');
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: saveEmployeeSettings,
  }));

  const filteredEmployees = employees.filter(emp => 
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      
      <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-3">Select Employee</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="max-h-125 overflow-y-auto">
          {filteredEmployees.map((employee) => (
            <button
              key={employee.id}
              onClick={() => selectEmployee(employee)}
              className={`w-full p-4 text-left border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                selectedEmployee?.id === employee.id ? 'bg-purple-50 dark:bg-purple-500/10 border-l-4 border-l-purple-500' : ''
              }`}
              data-testid={`employee-${employee.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-linear-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                  {employee.full_name?.charAt(0) || 'E'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">{employee.full_name || 'Unknown'}</p>
                  <p className="text-xs text-slate-500 truncate">{employee.employer_name || 'No employer'}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  employee.risk_level === 'low' ? 'bg-emerald-100 text-emerald-700' :
                  employee.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {employee.risk_level || 'N/A'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      
      <div className="lg:col-span-2 space-y-6">
        {selectedEmployee && employeeSettings ? (
          <>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-linear-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {selectedEmployee.full_name?.charAt(0) || 'E'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedEmployee.full_name}</h2>
                    <p className="text-slate-500">{selectedEmployee.email}</p>
                    <p className="text-sm text-slate-400">{selectedEmployee.employer_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1.5 text-sm font-semibold rounded-full ${
                    selectedEmployee.risk_level === 'low' ? 'bg-emerald-100 text-emerald-700' :
                    selectedEmployee.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedEmployee.risk_level ? selectedEmployee.risk_level.charAt(0).toUpperCase() + selectedEmployee.risk_level.slice(1) : 'N/A'} Risk
                  </span>
                </div>
              </div>

              
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{employeeSettings.advance_limit_percent || 60}%</p>
                  <p className="text-xs text-slate-500">Limit</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedEmployee.risk_score?.toFixed(1) || 'N/A'}</p>
                  <p className="text-xs text-slate-500">Risk Score</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{employeeStats?.total_advances || 0}</p>
                  <p className="text-xs text-slate-500">Advances</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{employeeStats?.repayment_rate || 100}%</p>
                  <p className="text-xs text-slate-500">Repayment</p>
                </div>
              </div>
            </div>

            
            <SectionCard title="Individual EWA Settings" icon={Sliders} description="Override default settings for this employee">
              <div className="space-y-6">
                <Toggle
                  label="Use Custom Settings"
                  description="Override employer defaults for this employee"
                  enabled={employeeSettings.use_custom_settings ?? false}
                  onChange={(v) => setEmployeeSettings({ ...employeeSettings, use_custom_settings: v })}
                />
                
                {employeeSettings.use_custom_settings && (
                  <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <RangeSlider
                      label="Custom Advance Limit"
                      min={employerSettings?.employee_advance_limit_min || 10}
                      max={employerSettings?.employee_advance_limit_max || 80}
                      value={employeeSettings.advance_limit_percent || 60}
                      onChange={(v) => setEmployeeSettings({ ...employeeSettings, advance_limit_percent: v })}
                      unit="%"
                      helpText={employerSettings ? `Employer range: ${employerSettings.employee_advance_limit_min || 10}% - ${employerSettings.employee_advance_limit_max || 60}%` : undefined}
                    />
                    <RangeSlider
                      label="Custom Cooldown"
                      min={employerSettings?.employee_cooldown_min || 0}
                      max={employerSettings?.employee_cooldown_max || 14}
                      value={employeeSettings.cooldown_days || 3}
                      onChange={(v) => setEmployeeSettings({ ...employeeSettings, cooldown_days: v })}
                      unit=" days"
                    />
                    <RangeSlider
                      label="Max Monthly Advances"
                      min={1}
                      max={30}
                      value={employeeSettings.max_monthly_advances || 10}
                      onChange={(v) => setEmployeeSettings({ ...employeeSettings, max_monthly_advances: v })}
                      unit=" requests"
                    />
                    <RangeSlider
                      label="Custom Fee Rate"
                      min={2}
                      max={8}
                      step={0.5}
                      value={employeeSettings.fee_rate || 4.5}
                      onChange={(v) => setEmployeeSettings({ ...employeeSettings, fee_rate: v })}
                      unit="%"
                    />
                  </div>
                )}
              </div>
            </SectionCard>

            
            <SectionCard title="Access & Restrictions" icon={Shield} description="Control employee access">
              <div className="space-y-3">
                <Toggle
                  label="EWA Access Enabled"
                  description="Allow this employee to request advances"
                  enabled={employeeSettings.ewa_enabled ?? true}
                  onChange={(v) => setEmployeeSettings({ ...employeeSettings, ewa_enabled: v })}
                />
                <Toggle
                  label="VIP Status"
                  description="Priority processing and higher limits"
                  enabled={employeeSettings.vip_status ?? false}
                  onChange={(v) => setEmployeeSettings({ ...employeeSettings, vip_status: v })}
                />
                <Toggle
                  label="Require Manual Approval"
                  description="All advances need admin approval"
                  enabled={employeeSettings.manual_approval ?? false}
                  onChange={(v) => setEmployeeSettings({ ...employeeSettings, manual_approval: v })}
                />
                <Toggle
                  label="Watchlist"
                  description="Flag for enhanced monitoring"
                  enabled={employeeSettings.on_watchlist ?? false}
                  onChange={(v) => setEmployeeSettings({ ...employeeSettings, on_watchlist: v })}
                />
              </div>
            </SectionCard>

            
            <SectionCard title="Admin Notes" icon={FileText} description="Internal notes about this employee">
              <textarea
                value={employeeSettings.admin_notes || ''}
                onChange={(e) => setEmployeeSettings({ ...employeeSettings, admin_notes: e.target.value })}
                placeholder="Add notes about this employee..."
                className="w-full h-32 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
              />
            </SectionCard>
          </>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Select an Employee</h3>
            <p className="text-slate-500">Choose an employee from the list to configure their individual settings</p>
          </div>
        )}
      </div>
    </div>
  );
});

EmployeeConfigTab.displayName = 'EmployeeConfigTab';

interface RiskComplianceTabProps {
  settings: RiskSettings;
  onUpdate: (updatedSettings: RiskSettings) => void;
  loading: boolean;
}

const RiskComplianceTab: React.FC<RiskComplianceTabProps> = ({ 
  settings, 
  onUpdate, 
  loading 
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <SectionCard title="Risk Score Thresholds" icon={TrendingUp} description="Define risk level boundaries (tied to Fraud Detection)">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900 dark:text-white">Employer Risk Bands</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Low Risk (A)</span>
                <Input
                  type="number"
                  value={settings.employer_low_threshold || 80}
                  onChange={(e) => onUpdate({ ...settings, employer_low_threshold: parseInt(e.target.value) })}
                  className="w-20 text-center"
                />
                <span className="text-sm text-slate-500">- 100</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Medium Risk (B)</span>
                <Input
                  type="number"
                  value={settings.employer_medium_threshold || 60}
                  onChange={(e) => onUpdate({ ...settings, employer_medium_threshold: parseInt(e.target.value) })}
                  className="w-20 text-center"
                />
                <span className="text-sm text-slate-500">- {(settings.employer_low_threshold || 80) - 1}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-500/10 rounded-lg">
                <span className="text-sm font-medium text-red-700 dark:text-red-400">High Risk (C/D)</span>
                <span className="text-sm text-slate-500">0</span>
                <span className="text-sm text-slate-500">- {(settings.employer_medium_threshold || 60) - 1}</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900 dark:text-white">Employee Risk Bands</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Low Risk</span>
                <Input
                  type="number"
                  value={settings.employee_low_threshold || 80}
                  onChange={(e) => onUpdate({ ...settings, employee_low_threshold: parseInt(e.target.value) })}
                  className="w-20 text-center"
                />
                <span className="text-sm text-slate-500">- 100</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Medium Risk</span>
                <Input
                  type="number"
                  value={settings.employee_medium_threshold || 60}
                  onChange={(e) => onUpdate({ ...settings, employee_medium_threshold: parseInt(e.target.value) })}
                  className="w-20 text-center"
                />
                <span className="text-sm text-slate-500">- {(settings.employee_low_threshold || 80) - 1}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-500/10 rounded-lg">
                <span className="text-sm font-medium text-red-700 dark:text-red-400">High Risk</span>
                <span className="text-sm text-slate-500">0</span>
                <span className="text-sm text-slate-500">- {(settings.employee_medium_threshold || 60) - 1}</span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      
      <SectionCard title="Automatic Actions" icon={Zap} description="Configure automatic risk responses">
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Auto-suspend at risk score below</Label>
              <Input
                type="number"
                value={settings.auto_suspend_threshold || 40}
                onChange={(e) => onUpdate({ ...settings, auto_suspend_threshold: parseInt(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Reduce limits at risk score below</Label>
              <Input
                type="number"
                value={settings.reduce_limits_threshold || 60}
                onChange={(e) => onUpdate({ ...settings, reduce_limits_threshold: parseInt(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="space-y-3">
            <Toggle
              label="Auto-suspend on fraud alert"
              description="Immediately suspend when fraud detected"
              enabled={settings.auto_suspend_on_fraud ?? true}
              onChange={(v) => onUpdate({ ...settings, auto_suspend_on_fraud: v })}
            />
            <Toggle
              label="Auto-reduce limits on warning"
              description="Reduce advance limits when warnings triggered"
              enabled={settings.auto_reduce_on_warning ?? true}
              onChange={(v) => onUpdate({ ...settings, auto_reduce_on_warning: v })}
            />
            <Toggle
              label="Notify admin on high-risk activity"
              description="Send alerts for suspicious activity"
              enabled={settings.notify_on_high_risk ?? true}
              onChange={(v) => onUpdate({ ...settings, notify_on_high_risk: v })}
            />
          </div>
        </div>
      </SectionCard>

      
      <SectionCard title="Verification Requirements" icon={UserCheck} description="KYC and verification settings">
        <div className="space-y-4">
          <Toggle
            label="Require ID Verification"
            description="National ID or Passport verification required"
            enabled={settings.require_id_verification ?? true}
            onChange={(v) => onUpdate({ ...settings, require_id_verification: v })}
          />
          <Toggle
            label="Require Face ID"
            description="Biometric face verification required"
            enabled={settings.require_face_id ?? true}
            onChange={(v) => onUpdate({ ...settings, require_face_id: v })}
          />
          <Toggle
            label="Require Address Proof"
            description="Proof of address document required"
            enabled={settings.require_address_proof ?? true}
            onChange={(v) => onUpdate({ ...settings, require_address_proof: v })}
          />
          <Toggle
            label="Require Employment Contract"
            description="Employment contract upload required"
            enabled={settings.require_employment_contract ?? true}
            onChange={(v) => onUpdate({ ...settings, require_employment_contract: v })}
          />
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <Label className="text-sm font-medium">Re-verification Frequency</Label>
            <select
              value={settings.reverification_frequency || 'biannually'}
              onChange={(e) => onUpdate({ ...settings, reverification_frequency: e.target.value as RiskSettings['reverification_frequency'] })}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biannually">Bi-annually (6 months)</option>
              <option value="annually">Annually</option>
              <option value="never">Never</option>
            </select>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

interface NotificationSettingsTabProps {
  settings: NotificationSettings;
  onUpdate: (updatedSettings: NotificationSettings) => void;
  loading: boolean;
}

const NotificationSettingsTab: React.FC<NotificationSettingsTabProps> = ({ 
  settings, 
  onUpdate, 
  loading 
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <SectionCard title="Email Notifications" icon={Mail} description="Configure email alert settings">
        <div className="space-y-3">
          <Toggle
            label="New Employer Registration"
            description="Alert when new employer signs up"
            enabled={settings.email_new_employer ?? true}
            onChange={(v) => onUpdate({ ...settings, email_new_employer: v })}
          />
          <Toggle
            label="Large Advance Requests"
            description="Alert for advances above threshold"
            enabled={settings.email_large_advance ?? true}
            onChange={(v) => onUpdate({ ...settings, email_large_advance: v })}
          />
          <Toggle
            label="Fraud Alerts"
            description="Immediate notification on fraud detection"
            enabled={settings.email_fraud_alert ?? true}
            onChange={(v) => onUpdate({ ...settings, email_fraud_alert: v })}
          />
          <Toggle
            label="Daily Summary Report"
            description="Daily digest of platform activity"
            enabled={settings.email_daily_summary ?? true}
            onChange={(v) => onUpdate({ ...settings, email_daily_summary: v })}
          />
          <Toggle
            label="Weekly Analytics Report"
            description="Weekly performance metrics"
            enabled={settings.email_weekly_report ?? true}
            onChange={(v) => onUpdate({ ...settings, email_weekly_report: v })}
          />
        </div>
      </SectionCard>

      
      <SectionCard title="SMS Notifications" icon={Smartphone} description="Configure SMS alert settings">
        <div className="space-y-3">
          <Toggle
            label="Critical Fraud Alerts"
            description="SMS for high-priority fraud cases"
            enabled={settings.sms_fraud_alert ?? true}
            onChange={(v) => onUpdate({ ...settings, sms_fraud_alert: v })}
          />
          <Toggle
            label="System Downtime Alerts"
            description="SMS when system issues detected"
            enabled={settings.sms_system_alert ?? true}
            onChange={(v) => onUpdate({ ...settings, sms_system_alert: v })}
          />
          <Toggle
            label="Large Transaction Alerts"
            description="SMS for transactions above threshold"
            enabled={settings.sms_large_transaction ?? false}
            onChange={(v) => onUpdate({ ...settings, sms_large_transaction: v })}
          />
        </div>
      </SectionCard>

      
      <SectionCard title="Alert Thresholds" icon={AlertTriangle} description="Define when alerts are triggered">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-medium">Large Advance Threshold (KES)</Label>
            <Input
              type="number"
              value={settings.large_advance_threshold || 50000}
              onChange={(e) => onUpdate({ ...settings, large_advance_threshold: parseInt(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Daily Volume Alert Threshold (KES)</Label>
            <Input
              type="number"
              value={settings.daily_volume_threshold || 1000000}
              onChange={(e) => onUpdate({ ...settings, daily_volume_threshold: parseInt(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Fraud Alert Email Recipients</Label>
            <Input
              type="text"
              value={settings.fraud_alert_emails || 'support@eaziwage.com'}
              onChange={(e) => onUpdate({ ...settings, fraud_alert_emails: e.target.value })}
              placeholder="email1@example.com, email2@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Admin SMS Numbers</Label>
            <Input
              type="text"
              value={settings.admin_sms_numbers || '+254700000000'}
              onChange={(e) => onUpdate({ ...settings, admin_sms_numbers: e.target.value })}
              placeholder="+254700000000, +254711111111"
              className="mt-1"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

interface BlackoutPeriodsTabProps {
  token: string | null;
}

const BlackoutPeriodsTab: React.FC<BlackoutPeriodsTabProps> = ({ token }) => {
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingBlackout, setEditingBlackout] = useState<Blackout | null>(null);
  const [newBlackout, setNewBlackout] = useState<Omit<Blackout, 'id'>>({
    name: '',
    start_date: '',
    end_date: '',
    applies_to: 'all',
    reason: '',
    is_active: true
  });

  const fetchBlackouts = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/settings/blackouts`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setBlackouts(data);
      }
    } catch {
      console.error('Error fetching blackouts:');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchBlackouts();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchBlackouts]);

  const saveBlackout = async () => {
    if (!newBlackout.name || !newBlackout.start_date || !newBlackout.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const url = editingBlackout 
        ? `/api/admin/settings/blackouts/${editingBlackout.id}`
        : `/api/admin/settings/blackouts`;
      
      const response = await fetch(url, {
        method: editingBlackout ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(newBlackout)
      });

      if (response.ok) {
        toast.success(editingBlackout ? 'Blackout period updated' : 'Blackout period created');
        fetchBlackouts();
        setShowModal(false);
        setEditingBlackout(null);
        setNewBlackout({ name: '', start_date: '', end_date: '', applies_to: 'all', reason: '', is_active: true });
      } else {
        toast.error('Failed to save blackout period');
      }
    } catch {
      toast.error('Error saving blackout period');
    }
  };

  const deleteBlackout = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this blackout period?')) return;
    
    try {
      const response = await fetch(`/api/admin/settings/blackouts/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        toast.success('Blackout period deleted');
        fetchBlackouts();
      }
    } catch {
      toast.error('Error deleting blackout period');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Blackout Periods</h3>
          <p className="text-sm text-slate-500">Define periods when advances are blocked</p>
        </div>
        <Button 
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-linear-to-r from-purple-500 to-violet-600 text-white"
          data-testid="add-blackout-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Blackout Period
        </Button>
      </div>

      
      <div className="grid gap-4">
        {blackouts.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <CalendarOff className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400">No blackout periods configured</p>
          </div>
        ) : (
          blackouts.map((blackout) => (
            <div 
              key={blackout.id}
              className={`bg-white dark:bg-slate-800 rounded-2xl border p-5 ${
                blackout.is_active ? 'border-red-200 dark:border-red-500/30' : 'border-slate-200 dark:border-slate-700 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    blackout.is_active ? 'bg-red-100 dark:bg-red-500/20' : 'bg-slate-100 dark:bg-slate-700'
                  }`}>
                    <CalendarOff className={`w-6 h-6 ${blackout.is_active ? 'text-red-600' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{blackout.name}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {new Date(blackout.start_date).toLocaleDateString()} - {new Date(blackout.end_date).toLocaleDateString()}
                    </p>
                    {blackout.reason && (
                      <p className="text-sm text-slate-500 mt-1">{blackout.reason}</p>
                    )}
                    <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                      blackout.applies_to === 'all' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      Applies to: {blackout.applies_to}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setEditingBlackout(blackout);
                      setNewBlackout(blackout);
                      setShowModal(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deleteBlackout(blackout.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingBlackout ? 'Edit Blackout Period' : 'Add Blackout Period'}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => { setShowModal(false); setEditingBlackout(null); }}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Name *</Label>
                <Input
                  value={newBlackout.name}
                  onChange={(e) => setNewBlackout({ ...newBlackout, name: e.target.value })}
                  placeholder="e.g., End of Year Holiday"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Start Date *</Label>
                  <Input
                    type="date"
                    value={newBlackout.start_date}
                    onChange={(e) => setNewBlackout({ ...newBlackout, start_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">End Date *</Label>
                  <Input
                    type="date"
                    value={newBlackout.end_date}
                    onChange={(e) => setNewBlackout({ ...newBlackout, end_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Applies To</Label>
                <select
                  value={newBlackout.applies_to}
                  onChange={(e) => setNewBlackout({ ...newBlackout, applies_to: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="all">All Employers & Employees</option>
                  <option value="KE">Kenya Only</option>
                  <option value="UG">Uganda Only</option>
                  <option value="TZ">Tanzania Only</option>
                  <option value="RW">Rwanda Only</option>
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium">Reason</Label>
                <Input
                  value={newBlackout.reason || ''}
                  onChange={(e) => setNewBlackout({ ...newBlackout, reason: e.target.value })}
                  placeholder="Optional description"
                  className="mt-1"
                />
              </div>
              <Toggle
                label="Active"
                description="Enable this blackout period"
                enabled={newBlackout.is_active}
                onChange={(v) => setNewBlackout({ ...newBlackout, is_active: v })}
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => { setShowModal(false); setEditingBlackout(null); }} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={saveBlackout} className="rounded-xl bg-linear-to-r from-purple-500 to-violet-600 text-white">
                <Save className="w-4 h-4 mr-2" />
                {editingBlackout ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface LegalDocumentsTabProps {
  token: string | null;
}

const LegalDocumentsTab: React.FC<LegalDocumentsTabProps> = ({ token }) => {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const [editedContent, setEditedContent] = useState<Partial<LegalDocument>>({});

  const docTypes: DocumentType[] = [
    { type: 'employee_terms', label: 'Employee Terms & Conditions', icon: FileCheck },
    { type: 'employer_partnership', label: 'Employer Partnership Agreement', icon: BookOpen },
    { type: 'privacy_policy', label: 'Privacy Policy', icon: Shield },
  ];

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/settings/legal-documents`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch {
      console.error('Error fetching documents:');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchDocuments();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchDocuments]);

  const selectDocument = async (docType: LegalDocument['document_type']) => {
    try {
      const response = await fetch(`/api/admin/settings/legal-documents/${docType}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedDoc(data);
        setEditedContent(data);
      } else {
        const defaultDoc: LegalDocument = { 
          document_type: docType, 
          title: '', 
          content: '', 
          version: '1.0', 
          effective_date: new Date().toISOString().split('T')[0] 
        };
        setSelectedDoc(defaultDoc);
        setEditedContent(defaultDoc);
      }
    } catch {
      console.error('Error fetching document:');
    }
  };

  const saveDocument = async () => {
    if (!selectedDoc?.document_type) return;
    
    try {
      const response = await fetch(`/api/admin/settings/legal-documents/${selectedDoc.document_type}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...editedContent,
          is_active: true
        })
      });
      if (response.ok) {
        toast.success('Document saved successfully');
        setEditing(false);
        fetchDocuments();
        selectDocument(selectedDoc.document_type);
      } else {
        toast.error('Failed to save document');
      }
    } catch {
      toast.error('Error saving document');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      
      <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Legal Documents</h3>
          <p className="text-sm text-slate-500 mt-1">Select a document to view or edit</p>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {docTypes.map((doc) => {
            const existingDoc = documents.find(d => d.document_type === doc.type && d.is_active);
            return (
              <button
                key={doc.type}
                onClick={() => selectDocument(doc.type)}
                className={`w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                  selectedDoc?.document_type === doc.type ? 'bg-purple-50 dark:bg-purple-500/10 border-l-4 border-l-purple-500' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center">
                    <doc.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{doc.label}</p>
                    {existingDoc && (
                      <p className="text-xs text-slate-500">Version {existingDoc.version}</p>
                    )}
                  </div>
                  {existingDoc ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Draft</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      
      <div className="lg:col-span-2">
        {selectedDoc ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {docTypes.find(d => d.type === selectedDoc.document_type)?.label}
                </h3>
                <p className="text-sm text-slate-500">Version {selectedDoc.version || '1.0'}</p>
              </div>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <Button variant="outline" onClick={() => { setEditing(false); setEditedContent(selectedDoc); }} className="rounded-xl">
                      Cancel
                    </Button>
                    <Button onClick={saveDocument} className="rounded-xl bg-linear-to-r from-purple-500 to-violet-600 text-white">
                      <Save className="w-4 h-4 mr-2" />
                      Save Document
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setEditing(true)} className="rounded-xl bg-linear-to-r from-purple-500 to-violet-600 text-white">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
            <div className="p-6 space-y-4">
              {editing ? (
                <>
                  <div>
                    <Label className="text-sm font-medium">Document Title</Label>
                    <Input
                      value={editedContent.title || ''}
                      onChange={(e) => setEditedContent({ ...editedContent, title: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Version</Label>
                      <Input
                        value={editedContent.version || '1.0'}
                        onChange={(e) => setEditedContent({ ...editedContent, version: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Effective Date</Label>
                      <Input
                        type="date"
                        value={editedContent.effective_date || ''}
                        onChange={(e) => setEditedContent({ ...editedContent, effective_date: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Content (Markdown supported)</Label>
                    <textarea
                      value={editedContent.content || ''}
                      onChange={(e) => setEditedContent({ ...editedContent, content: e.target.value })}
                      className="mt-1 w-full h-96 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono resize-none"
                      placeholder="Enter document content..."
                    />
                  </div>
                </>
              ) : (
                <div className="prose dark:prose-invert max-w-none">
                  <h2>{selectedDoc.title}</h2>
                  <p className="text-sm text-slate-500">Effective: {selectedDoc.effective_date || 'Not set'}</p>
                  <div className="mt-4 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl max-h-96 overflow-y-auto">
                    {selectedDoc.content || 'No content yet. Click Edit to add content.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Select a Document</h3>
            <p className="text-slate-500">Choose a document from the list to view or edit its content</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface AuditTrailTabProps {
  token: string | null;
}

const AuditTrailTab: React.FC<AuditTrailTabProps> = ({ token }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filters, setFilters] = useState<AuditFilters>({
    auditType: '',
    settingsType: '',
    changedBy: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState<Pagination>({ skip: 0, limit: 10, total: 0 });

  const fetchAuditData = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/audit-trail/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch {
      console.error('Error fetching audit stats:');
    }
  }, [token]);

  const fetchAdmins = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/audit-trail/admins`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setAdmins(data);
      }
    } catch {
      console.error('Error fetching admins:');
    }
  }, [token]);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', pagination.limit.toString());
      params.append('skip', pagination.skip.toString());
      if (filters.auditType) params.append('audit_type', filters.auditType);
      if (filters.settingsType) params.append('settings_type', filters.settingsType);
      if (filters.changedBy) params.append('changed_by', filters.changedBy);
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);

      const response = await fetch(`/api/admin/audit-trail?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setPagination(prev => ({ ...prev, total: data.total }));
      }
    } catch {
      console.error('Error fetching audit logs:');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, pagination.skip, token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchAuditData();
      fetchAdmins();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAuditData, fetchAdmins]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchAuditLogs();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAuditLogs]);

  return (
    <div className="space-y-6">
      
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-linear-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_changes}</p>
                <p className="text-sm text-slate-500">Total Changes</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-linear-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.by_type?.employer_settings || 0}</p>
                <p className="text-sm text-slate-500">Employer Changes</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-linear-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.by_type?.employee_settings || 0}</p>
                <p className="text-sm text-slate-500">Employee Changes</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.by_admin?.length || 0}</p>
                <p className="text-sm text-slate-500">Active Admins</p>
              </div>
            </div>
          </div>
        </div>
      )}

      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-purple-500" />
          Filter Audit Logs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Category</Label>
            <select
              value={filters.auditType}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, auditType: e.target.value }));
                setPagination(prev => ({ ...prev, skip: 0 }));
              }}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Categories</option>
              <option value="platform_settings">Platform Settings</option>
              <option value="risk_settings">Risk & Compliance</option>
              <option value="notification_settings">Notifications Settings</option>
              <option value="employer_settings">Employer Settings</option>
              <option value="employee_settings">Employee Settings</option>
              <option value="legal_document">Legal Documents</option>
              <option value="blackout">Blackout Periods</option>
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Changed By</Label>
            <select
              value={filters.changedBy}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, changedBy: e.target.value }));
                setPagination(prev => ({ ...prev, skip: 0 }));
              }}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Admins</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Start Date</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, startDate: e.target.value }));
                setPagination(prev => ({ ...prev, skip: 0 }));
              }}
              className="mt-1 h-10"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">End Date</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, endDate: e.target.value }));
                setPagination(prev => ({ ...prev, skip: 0 }));
              }}
              className="mt-1 h-10"
            />
          </div>
        </div>

        {(filters.auditType || filters.changedBy || filters.startDate || filters.endDate) && (
          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({
                  auditType: '',
                  settingsType: '',
                  changedBy: '',
                  startDate: '',
                  endDate: ''
                });
                setPagination(prev => ({ ...prev, skip: 0 }));
              }}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
            <p className="text-slate-500 text-sm">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">No audit logs found</p>
            <p className="text-slate-500 text-xs mt-1">Try adjusting your filters or search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date/Time</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Category</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action/Description</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Target</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {logs.map((log) => {
                  let badgeStyles = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
                  let categoryLabel: string = log.type;

                  switch (log.type) {
                    case 'platform_settings':
                      badgeStyles = 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
                      categoryLabel = 'Platform';
                      break;
                    case 'risk_settings':
                      badgeStyles = 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
                      categoryLabel = 'Risk & Compliance';
                      break;
                    case 'notification_settings':
                      badgeStyles = 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400';
                      categoryLabel = 'Notifications';
                      break;
                    case 'employer_settings':
                      badgeStyles = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
                      categoryLabel = 'Employer Settings';
                      break;
                    case 'employee_settings':
                      badgeStyles = 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
                      categoryLabel = 'Employee Settings';
                      break;
                    case 'legal_document':
                      badgeStyles = 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400';
                      categoryLabel = 'Legal';
                      break;
                    case 'blackout':
                      badgeStyles = 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400';
                      categoryLabel = 'Blackout';
                      break;
                  }

                  const formattedDate = new Date(log.changed_at).toLocaleString();
                  const targetLabel = log.employee_name || log.employer_name || '-';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-md font-semibold ${badgeStyles}`}>
                          {categoryLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white max-w-xs truncate">
                        {log.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {targetLabel}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {log.changed_by_name || 'System'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        
        {!loading && logs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold">{pagination.skip + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(pagination.skip + logs.length, pagination.total)}</span> of{' '}
              <span className="font-semibold">{pagination.total}</span> entries
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, skip: Math.max(0, prev.skip - prev.limit) }))}
                disabled={pagination.skip === 0}
                className="h-8 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, skip: prev.skip + prev.limit }))}
                disabled={pagination.skip + logs.length >= pagination.total}
                className="h-8 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface AdminProfileData {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

const AdminProfileTab: React.FC = () => {
  const [profile, setProfile] = useState<AdminProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaEnabledLocal, setMfaEnabledLocal] = useState<boolean>(false);

  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const res = await fetch('/api/admin/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!data.error) {
            setProfile({
              user_id: data.user_id,
              email: data.email,
              full_name: data.full_name,
              avatar_url: data.avatar_url,
            });

            try {
              const mfaRes = await fetch('/api/admin/security/mfa');
              if (mfaRes.ok) {
                const mfaJson = await mfaRes.json();
                setMfaEnabledLocal(Boolean(mfaJson?.enabled));
              }
            } catch (mfaErr) {
              console.warn('Failed to fetch MFA status:', mfaErr);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch admin profile:', err);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchAdminProfile();
  }, []);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Could not load profile. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <SectionCard title="Profile Information" icon={User} description="Your personal details">
        <div className="space-y-6">
          
          <div className="flex items-center gap-6">
            <AvatarUpload
              currentAvatarUrl={profile.avatar_url ?? undefined}
              userId={profile.user_id}
              onUploadSuccess={() => {
                toast.success('Profile photo updated');
              }}
            />
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {profile.full_name || 'Admin User'}
              </h3>
              <p className="text-sm text-slate-500">{profile.email}</p>
            </div>
          </div>

          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                disabled
                defaultValue={profile.full_name || ''}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                defaultValue={profile.email || ''}
                className="rounded-lg"
                disabled
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Security" icon={Lock} description="Password and authentication settings">
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Change Password</p>
              <p className="text-sm text-slate-500">Update your account password</p>
            </div>
            <Button variant="outline" className="rounded-lg" onClick={() => setShowPasswordModal(true)}>Change</Button>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Two-Factor Authentication</p>
              <p className="text-sm text-slate-500">Add an extra layer of security</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-500 mr-2">{mfaEnabledLocal ? 'Enabled' : 'Disabled'}</p>
              <Button variant="outline" className="rounded-lg text-emerald-600 border-emerald-200 bg-emerald-50" onClick={() => setShowMfaModal(true)}>
                {mfaEnabledLocal ? 'Manage' : 'Enable'}
              </Button>
            </div>
          </div>
        </div>

        
        {showPasswordModal && (
          <PasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
        )}
        {showMfaModal && (
          <MfaManagerModal isOpen={showMfaModal} onClose={async () => { setShowMfaModal(false);  try { const res = await fetch('/api/admin/security/mfa'); if (res.ok) { const js = await res.json(); setMfaEnabledLocal(Boolean(js?.enabled)); } } catch {} }} />
        )}
      </SectionCard>
    </div>
  );
};

const PasswordModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Change Password</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">Close</button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input value={newPassword} type="password" onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 inline-flex items-center justify-center rounded-xl border border-input bg-background h-10 px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={async () => {
                if (!newPassword || newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
                setSubmitting(true);
                try {
                  const res = await fetch('/api/admin/security/password', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword })
                  });
                  const json = await res.json();
                  if (res.ok && json.success) {
                    toast.success('Password updated');
                    onClose();
                  } else {
                    toast.error(json.error || 'Failed to update password');
                  }
                } catch (err) {
                  console.error('Password change failed', err);
                  toast.error('Failed to update password');
                } finally { setSubmitting(false); }
              }}
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-primary text-white h-10 px-4 py-2 text-sm"
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MfaFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  created_at: string;
}

const MfaManagerModal: React.FC<{ isOpen: boolean; onClose: () => Promise<void> | void }> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [stage, setStage] = useState<'idle'|'enrolling'|'verifying'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/security/mfa');
        const js = await res.json();
        setFactors(js?.factors || []);
      } catch (err) {
        console.error('Failed to fetch MFA factors', err);
      } finally { setLoading(false); }
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const startEnroll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable', friendlyName: 'Admin Authenticator' })
      });
      const js = await res.json();
      if (res.ok && js.success) {
        setQrCode(js.qrCode || null);
        setSecret(js.secret || null);
        setFactorId(js.factorId || null);
        setStage('verifying');
      } else {
        toast.error(js.error || 'Failed to start MFA enrollment');
      }
    } catch (err) {
      console.error('MFA enroll failed', err);
      toast.error('Failed to start MFA enrollment');
    } finally { setLoading(false); }
  };

  const verifyEnroll = async () => {
    if (!factorId || !code) { toast.error('Enter verification code'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', factorId, code })
      });
      const js = await res.json();
      if (res.ok && js.success) {
        toast.success('MFA enabled');
        await Promise.resolve(onClose?.());
      } else {
        toast.error(js.error || 'Verification failed');
      }
    } catch (err) {
      console.error('MFA verify failed', err);
      toast.error('Verification failed');
    } finally { setLoading(false); }
  };

  const disableFactor = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', factorId: id })
      });
      const js = await res.json();
      if (res.ok && js.success) {
        toast.success('MFA disabled');
        const r = await fetch('/api/admin/security/mfa'); const j = await r.json(); setFactors(j?.factors || []);
      } else {
        toast.error(js.error || 'Failed to disable MFA');
      }
    } catch (err) {
      console.error('Disable MFA failed', err);
      toast.error('Failed to disable MFA');
    } finally { setLoading(false); }
  };

  const genBackupCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security/mfa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_backup_codes' })
      });
      const js = await res.json();
      if (res.ok && js.success) {
        const codes = js.backupCodes || js.backupCodes || [];
        toast.success('Backup codes generated — copy and store them safely');
        alert('Backup codes:\n' + (codes.join('\n')));
      } else {
        toast.error(js.error || 'Failed to generate backup codes');
      }
    } catch (err) {
      console.error('Generate backup failed', err);
      toast.error('Failed to generate backup codes');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Manage MFA</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => { onClose(); }} className="text-slate-400 hover:text-slate-600">Close</button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600">Current factors</p>
            <div className="mt-3 space-y-2">
              {loading && <div className="text-sm text-slate-500">Loading...</div>}
              {!loading && factors.length === 0 && <div className="text-sm text-slate-500">No MFA factors enrolled.</div>}
              {factors.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <div className="font-medium">{f.friendly_name || 'Authenticator App'}</div>
                    <div className="text-xs text-slate-500">{f.factor_type} • created {new Date(f.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => disableFactor(f.id)}>Disable</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t">
            {stage === 'idle' && (
              <div className="flex gap-3">
                <button onClick={startEnroll} className="inline-flex items-center justify-center rounded-xl bg-primary text-white h-10 px-4">Enable MFA</button>
                <button onClick={genBackupCodes} className="inline-flex items-center justify-center rounded-xl border h-10 px-4">Generate Backup Codes</button>
              </div>
            )}

            {stage === 'verifying' && (
              <div className="space-y-3">
                {qrCode && (
                  <div>
                    <p className="text-sm text-slate-600">Scan this QR code with your authenticator app and enter the 6-digit code below.</p>
                    <div className="mt-3">
                      <Image src={qrCode} alt="MFA QR" width={200} height={200} className="max-w-xs" unoptimized />
                    </div>
                    {secret && (
                      <p className="text-xs text-slate-500 mt-2">
                        Or enter this key manually: <code className="font-mono">{secret}</code>
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStage('idle')} className="inline-flex items-center justify-center rounded-xl border h-10 px-4">Cancel</button>
                  <button onClick={verifyEnroll} className="inline-flex items-center justify-center rounded-xl bg-primary text-white h-10 px-4">Verify</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminSettings: React.FC = () => {
  const [token] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabId | 'account'>('account');
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const employerConfigRef = useRef<SettingsSaveHandle>(null);
  const employeeConfigRef = useRef<SettingsSaveHandle>(null);
  const [employerSaveAvailable, setEmployerSaveAvailable] = useState(false);
  const [employeeSaveAvailable, setEmployeeSaveAvailable] = useState(false);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({});
  const [riskSettings, setRiskSettings] = useState<RiskSettings>({});
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({});
  
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    async function fetchSecurityLogs() {
      if (activeTab === 'security') {
        setLogsLoading(true);
        try {
          const res = await fetch('/api/auth/activity-logs');
          if (res.ok) {
            const data = await res.json();
            setSecurityLogs(data.logs || []);
          }
        } finally {
          setLogsLoading(false);
        }
      }
    }
    fetchSecurityLogs();
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [globalRes, riskRes, notifRes] = await Promise.all([
          fetch(`/api/admin/settings/platform`),
          fetch(`/api/admin/settings/risk`),
          fetch(`/api/admin/settings/notifications`),
        ]);

        if (cancelled) return;

        if (globalRes.ok) setGlobalSettings(await globalRes.json());
        if (riskRes.ok) setRiskSettings(await riskRes.json());
        if (notifRes.ok) setNotificationSettings(await notifRes.json());
      } catch {
        console.error('Error fetching settings:');
        toast.error('Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const promises: Promise<Response>[] = [];
      
      if (activeTab === 'global') {
        promises.push(
          fetch(`/api/admin/settings/platform`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(globalSettings)
          })
        );
      }
      
      if (activeTab === 'risk') {
        promises.push(
          fetch(`/api/admin/settings/risk`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(riskSettings)
          })
        );
      }
      
      if (activeTab === 'notifications') {
        promises.push(
          fetch(`/api/admin/settings/notifications`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(notificationSettings)
          })
        );
      }

      await Promise.all(promises);
      toast.success('Settings saved successfully');
      setHasChanges(false);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    if (activeTab === 'employer') {
      setSaving(true);
      try {
        await employerConfigRef.current?.save();
      } finally {
        setSaving(false);
      }
      return;
    }

    if (activeTab === 'employee') {
      setSaving(true);
      try {
        await employeeConfigRef.current?.save();
      } finally {
        setSaving(false);
      }
      return;
    }

    await handleSaveAll();
  };

  const tabs: { id: TabId | 'account'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'account', label: 'Profile', icon: User },
    { id: 'global', label: 'Global Settings', icon: Globe },
    { id: 'employer', label: 'Employer Config', icon: Building2 },
    { id: 'employee', label: 'Employee Config', icon: Users },
    { id: 'risk', label: 'Risk & Compliance', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'blackouts', label: 'Blackout Periods', icon: CalendarOff },
    { id: 'legal', label: 'Legal Docs', icon: FileCheck },
    { id: 'audit', label: 'Audit Trail', icon: ClipboardList },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  const tabsWithCommonSave = ['global', 'employer', 'employee', 'risk', 'notifications'];
  const showCommonSaveButton = tabsWithCommonSave.includes(activeTab);
  const canSaveCurrentTab =
    ['global', 'risk', 'notifications'].includes(activeTab) ||
    (activeTab === 'employer' && employerSaveAvailable) ||
    (activeTab === 'employee' && employeeSaveAvailable);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              Admin Settings Portal
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Configure EWA platform settings, employer rules, risk ranges, and compliance requirements
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Unsaved changes
              </span>
            )}
            {showCommonSaveButton && (
              <Button 
                onClick={handleSaveChanges}
                disabled={saving || !canSaveCurrentTab}
                className="rounded-xl bg-linear-to-r from-purple-500 to-violet-600 text-white"
                data-testid="save-settings-btn"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        
        <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        
        {activeTab === 'account' && <AdminProfileTab />}
        {activeTab === 'global' && (
          <GlobalSettingsTab 
            settings={globalSettings} 
            onUpdate={(s) => { setGlobalSettings(s); setHasChanges(true); }}
            loading={false}
          />
        )}
        {activeTab === 'employer' && (
          <EmployerConfigTab
            ref={employerConfigRef}
            token={token}
            onSave={() => setHasChanges(false)}
            onSaveAvailabilityChange={setEmployerSaveAvailable}
          />
        )}
        {activeTab === 'employee' && (
          <EmployeeConfigTab
            ref={employeeConfigRef}
            token={token}
            onSave={() => setHasChanges(false)}
            onSaveAvailabilityChange={setEmployeeSaveAvailable}
          />
        )}
        {activeTab === 'risk' && (
          <RiskComplianceTab
            settings={riskSettings}
            onUpdate={(s) => { setRiskSettings(s); setHasChanges(true); }}
            loading={false}
          />
        )}
        {activeTab === 'notifications' && (
          <NotificationSettingsTab
            settings={notificationSettings}
            onUpdate={(s) => { setNotificationSettings(s); setHasChanges(true); }}
            loading={false}
          />
        )}
        {activeTab === 'blackouts' && (
          <BlackoutPeriodsTab token={token} />
        )}
        {activeTab === 'legal' && (
          <LegalDocumentsTab token={token} />
        )}
        {activeTab === 'audit' && (
          <AuditTrailTab token={token} />
        )}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <SectionCard title="Admin Multi-Factor Authentication" icon={Shield} description="Secure your admin access with TOTP">
              <Toggle
                label="Authenticator App (TOTP)"
                description="Require a code from an app like Google Authenticator to log in"
                enabled={mfaEnabled}
                onChange={(v) => setMfaEnabled(v)}
              />
            </SectionCard>

            <SectionCard title="Your Recent Activity" icon={History} description="Security-related events for your account">
              <div className="space-y-4">
                {logsLoading ? (
                  <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-purple-500" /></div>
                ) : securityLogs.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No security events recorded.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {securityLogs.map((log, idx) => (
                      <div key={idx} className="py-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{log.action.replace('_', ' ')}</p>
                          <p className="text-xs text-slate-500 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                            {log.metadata?.ip || 'Verified'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        )}
      </div>
  );
}

export default AdminSettings;
