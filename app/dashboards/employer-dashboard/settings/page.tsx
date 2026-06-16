"use client"
import React, { useState, useEffect } from "react"
import {
  Building2, Users, CreditCard, Bell,
  Shield, Clock, Save, AlertCircle, CheckCircle2,
  Percent, Calendar, Wallet, Lock, Mail, BarChart3, ChevronRight,
  FileText, HelpCircle, Eye, Download, Upload, ExternalLink,
  MessageSquare, Phone, MapPin, Globe, X, Loader2,
  LucideIcon, User, Smartphone, History
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { logout } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout'
import { toast } from "sonner";
import { cn, getAdvanceLimit, getCurrencySymbol, getCurrencyFromCountry } from "@/lib/utils";
import { AvatarUpload } from '@/components/ui/AvatarUpload';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployerProfile {
  id: string;
  company_name: string;
  company_code?: string;
  status: string;
  full_name?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  payroll_cycle?: string;
  physical_address?: string;
  city?: string;
  postal_code?: string;
  county_region?: string;
  country?: string;
  currency?: string;
  email_notifications?: boolean;
  advance_alerts?: boolean;
  payroll_reminders?: boolean;
  weekly_reports?: boolean;
  max_advance_percentage?: number;
  min_advance_amount?: number;
  max_advance_amount?: number;
  advance_access_days?: [number, number];
  cooldown_period?: number;
  bank_name?: string;
  bank_account_number?: string;
  registration_number?: string;
  tax_id?: string;
  industry?: string;
  sector?: string;
  documents?: Record<string, string>;
  avatar_url?: string;
}

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
}

interface ActivityLog {
  action: string;
  created_at: string;
  metadata?: {
    ip?: string;
    location?: string;
    device_name?: string;
    user_agent?: string;
  };
}

interface Settings {
  maxAdvancePercentage: number;
  minAdvanceAmount: number;
  maxAdvanceAmount: number;
  advanceAccessDays: [number, number];
  cooldownPeriod: number;
  emailNotifications: boolean;
  advanceAlerts: boolean;
  payrollReminders: boolean;
  weeklyReports: boolean;
  payrollCycle: string;
}

interface Profile {
  maxAdvancePercentage: number;
  minAdvanceAmount: number;
  maxAdvanceAmount: number;
  advanceAccessDays: [number, number];
  cooldownPeriod: number;
  emailNotifications: boolean;
  advanceAlerts: boolean;
  payrollReminders: boolean;
  weeklyReports: boolean;
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  payrollCycle: string;
  physicalAddress: string;
  city: string;
  postalCode: string;
  countyRegion: string;
  country: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TabButtonProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

const TabButton = ({ active, onClick, icon: Icon, label }: TabButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full",
      active
        ? "bg-primary text-white shadow-lg shadow-primary/25"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
    )}
  >
    <div className={cn(
      "w-9 h-9 rounded-xl flex items-center justify-center",
      active ? "bg-white/20" : "bg-primary"
    )}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <span className="font-medium">{label}</span>
    {active && <ChevronRight className="w-4 h-4 ml-auto" />}
  </button>
);

interface SettingsCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  locked?: boolean;
}

const SettingsCard = ({ icon: Icon, title, description, children, locked = false }: SettingsCardProps) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {locked && (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 dark:bg-amber-500/20 px-2 py-1 rounded-full">
          <Lock className="w-3 h-3" /> Requires Approval
        </span>
      )}
    </div>
    {children}
  </div>
);

interface ToggleItemProps {
  icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

const ToggleItem = ({ icon: Icon, label, description, checked, onToggle }: ToggleItemProps) => (
  <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onToggle} />
  </div>
);

interface DocumentItemProps {
  icon: LucideIcon;
  label: string;
  fileName?: string | null;
  status?: string | null;
  onView: () => void;
  onReupload: (file: File) => void | Promise<void>;
  accept?: string;
  isUploading?: boolean;
}

const DocumentItem = ({
  icon: Icon,
  label,
  fileName,
  status,
  onView,
  onReupload,
  accept = ".pdf,.jpg,.jpeg,.png",
  isUploading = false,
}: DocumentItemProps) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl relative overflow-hidden">
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        accept={accept}
        onChange={(e) => {
          if (e.target.files?.[0]) void onReupload(e.target.files[0]);
        }}
      />
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{label}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{fileName || 'Not uploaded'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          status === 'approved'
            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            : status === 'pending'
              ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
        )}>
          {status || 'Not uploaded'}
        </span>
        {fileName && (
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-9 px-3 transition-colors"
            onClick={onView}
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        <button
          className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-9 px-3 transition-colors disabled:pointer-events-none disabled:opacity-50"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading
            ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            : <Upload className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  );
};

interface FAQItemProps {
  question: string;
  answer: string;
}

const FAQItem = ({ question, answer }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-slate-200/50 dark:border-slate-700/30 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="font-medium text-slate-900 dark:text-white">{question}</span>
        <ChevronRight className={cn("w-5 h-5 text-slate-400 transition-transform", isOpen && "rotate-90")} />
      </button>
      {isOpen && (
        <div className="pb-4 text-slate-600 dark:text-slate-400 text-sm">{answer}</div>
      )}
    </div>
  );
};

interface BankChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { bank_name: string; bank_account_number: string; reason: string }) => Promise<void>;
  isSubmitting: boolean;
}

const BankChangeModal = ({ isOpen, onClose, onSubmit, isSubmitting }: BankChangeModalProps) => {
  const [formData, setFormData] = useState({ bank_name: '', bank_account_number: '', reason: '' });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Request Bank Change</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New Bank Name</Label>
            <Input
              placeholder="e.g. Standard Chartered"
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>New Account Number</Label>
            <Input
              placeholder="e.g. 0100XXXXXXX"
              value={formData.bank_account_number}
              onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason for Change</Label>
            <textarea
              className="w-full min-h-24 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Briefly explain why you're changing bank details..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Note:</strong> For security reasons, bank changes are manually reviewed. You may be contacted by our compliance team for verification.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(formData)}
              disabled={isSubmitting || !formData.bank_name || !formData.bank_account_number}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 h-10 px-4 py-2 text-sm font-medium shadow-lg shadow-primary/25 disabled:pointer-events-none disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Profile Tab ──────────────────────────────────────────────────────────────

interface EmployerProfileTabProps {
  employerId?: string;
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

const EmployerProfileTab = ({ employerId, fullName, email, avatarUrl }: EmployerProfileTabProps) => (
  <div className="space-y-6">
    <SettingsCard icon={Users} title="Your Profile" description="Manage your personal profile and account settings">
      <div className="flex flex-col items-center mb-8">
        <AvatarUpload
          userId={employerId}
          currentAvatarUrl={avatarUrl ?? undefined}
          fullName={fullName || email || undefined}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300">Full Name</Label>
          <Input value={fullName || ''} readOnly className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed" />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300">Email Address</Label>
          <Input value={email || ''} readOnly className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed" />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300">Role</Label>
          <Input value="Employer" readOnly className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed capitalize" />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300">Account ID</Label>
          <Input value={employerId || ''} readOnly className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed font-mono text-xs" />
        </div>
      </div>
    </SettingsCard>

    <SettingsCard icon={Shield} title="Account Security" description="Verify your account protection">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Email Verified</p>
            <p className="text-sm text-slate-500">Your primary email is confirmed</p>
          </div>
          <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
            <CheckCircle2 className="w-4 h-4" />Verified
          </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Active Session</p>
            <p className="text-sm text-slate-500">Current browser session is secure</p>
          </div>
          <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
            <Shield className="w-4 h-4" />Secure
          </div>
        </div>
      </div>
    </SettingsCard>
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getResponseErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
      if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
      return fallback;
    } catch {
      return text.trim() || fallback;
    }
  } catch {
    return fallback;
  }
};

const PAYROLL_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  'bi-weekly': 'Bi-Weekly',
  weekly: 'Weekly',
};

const COUNTRY_LABELS: Record<string, string> = {
  KE: 'Kenya',
  UG: 'Uganda',
  TZ: 'Tanzania',
  RW: 'Rwanda',
};

const faqItems = [
  {
    question: "How do I add new employees to EaziWage?",
    answer: "Navigate to the Employees page and click 'Add Employee'. You can add employees individually or upload a CSV file for bulk import. Each employee will receive an invitation to complete their KYC process."
  },
  {
    question: "What documents are required for employer verification?",
    answer: "You need: Certificate of Incorporation, KRA PIN Certificate, CR12 Document (Company Directors), Business Permit, and Proof of Bank Account. Audited Financials are recommended for better risk scoring."
  },
  {
    question: "How is the advance fee calculated?",
    answer: "The fee ranges from 3.5% to 6.5% based on your company's risk score. Better documentation, verified payroll integration, and good repayment history result in lower fees."
  },
  {
    question: "Can I set different advance limits for different employees?",
    answer: "Yes! Go to Employees > Click on an employee > EWA Settings. You can customize max advance percentage, amount limits, and cooldown periods per employee."
  },
  {
    question: "How do payroll deductions work?",
    answer: "Advances are automatically deducted from the next payroll cycle. You'll receive a reconciliation report before each payday showing total deductions to process."
  },
  {
    question: "What happens if an employee leaves the company?",
    answer: "Any outstanding advances become due immediately. The final settlement will include the deduction. Contact support for cases where the final salary doesn't cover the advance."
  }
];

interface Profile {
  maxAdvancePercentage: number;
  minAdvanceAmount: number;
  maxAdvanceAmount: number;
  advanceAccessDays: [number, number];
  cooldownPeriod: number;
  emailNotifications: boolean;
  advanceAlerts: boolean;
  payrollReminders: boolean;
  weeklyReports: boolean;
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  payrollCycle: string;
  physicalAddress: string;
  city: string;
  postalCode: string;
  countyRegion: string;
  country: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployerSettings() {
  const router = useRouter();

  const [employer, setEmployer] = useState<EmployerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);

  // MFA states
  const [mfaStatus, setMfaStatus] = useState({ enabled: false, loading: false, showSetup: false, qrCode: '', factorId: '' });
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaFactors, setMfaFactors] = useState<MFAFactor[]>([]);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });

  const [settings, setSettings] = useState<Settings>({
    maxAdvancePercentage: 50,
    minAdvanceAmount: 500,
    maxAdvanceAmount: 50000,
    advanceAccessDays: [1, 25],
    cooldownPeriod: 7,
    emailNotifications: true,
    advanceAlerts: true,
    payrollReminders: true,
    weeklyReports: false,
    payrollCycle: 'monthly',
  });

  const [profile, setProfile] = useState<Profile>({
    maxAdvancePercentage: 50,
    minAdvanceAmount: 500,
    maxAdvanceAmount: 50000,
    advanceAccessDays: [1, 25],
    cooldownPeriod: 7,
    emailNotifications: true,
    advanceAlerts: true,
    payrollReminders: true,
    weeklyReports: false,
    companyName: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    payrollCycle: 'monthly',
    physicalAddress: '',
    city: '',
    postalCode: '',
    countyRegion: '',
    country: 'KE',
  });

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchData = async (options?: { silent?: boolean }) => {
    await Promise.resolve();
    if (!options?.silent) setLoading(true);
    try {
      const [profileRes, settingsRes] = await Promise.all([
        fetch('/api/employer-dashboard/profile'),
        fetch('/api/employer-dashboard/settings'),
      ]);

      const profileData = profileRes.ok ? await profileRes.json() : null;
      const settingsData = settingsRes.ok ? await settingsRes.json() : null;

      const employerData = (profileData?.profile ?? settingsData?.employer) as EmployerProfile | undefined;
      const settingsEmployer = settingsData?.employer as Record<string, unknown> | undefined;

      if (employerData) {
        setEmployer(employerData);
        setProfile((prev) => ({
          ...prev,
          companyName: employerData.company_name || '',
          contactPerson: employerData.contact_person || employerData.full_name || '',
          contactEmail: employerData.contact_email || '',
          contactPhone: employerData.contact_phone || '',
          payrollCycle: employerData.payroll_cycle || prev.payrollCycle,
          physicalAddress: employerData.physical_address || '',
          city: employerData.city || '',
          postalCode: employerData.postal_code || '',
          countyRegion: employerData.county_region || '',
          country: employerData.country || 'KE',
        }));
      }

      if (settingsEmployer) {
        const rawDays = settingsEmployer.advance_access_days;
        const accessDays: [number, number] = Array.isArray(rawDays) && rawDays.length >= 2
          ? [Number(rawDays[0]) || 1, Number(rawDays[1]) || 25]
          : [1, 25];

        setSettings((prev) => ({
          ...prev,
          maxAdvancePercentage: Number(settingsEmployer.max_advance_percentage ?? prev.maxAdvancePercentage),
          minAdvanceAmount: Number(settingsEmployer.min_advance_amount ?? prev.minAdvanceAmount),
          maxAdvanceAmount: Number(settingsEmployer.max_advance_amount ?? prev.maxAdvanceAmount),
          advanceAccessDays: accessDays,
          cooldownPeriod: Number(settingsEmployer.cooldown_period ?? prev.cooldownPeriod),
          emailNotifications: Boolean(settingsEmployer.email_notifications ?? prev.emailNotifications),
          advanceAlerts: Boolean(settingsEmployer.advance_alerts ?? prev.advanceAlerts),
          payrollReminders: Boolean(settingsEmployer.payroll_reminders ?? prev.payrollReminders),
          weeklyReports: Boolean(settingsEmployer.weekly_reports ?? prev.weeklyReports),
          payrollCycle: String(settingsEmployer.payroll_cycle ?? prev.payrollCycle),
        }));
      }
    } catch (err) {
      console.error('Failed to load employer settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData({ silent: true });
  }, []);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!employer?.id) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`realtime:employer-settings:employer-${employer.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employee_onboarding', filter: `employer_id=eq.${employer.id}` }, () => {
        void fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employer?.id]);

  // Security data fetching
  useEffect(() => {
    if (activeTab !== 'security') return;
    
    const fetchSecurityData = async () => {
      await Promise.resolve();
      setLogsLoading(true);
      try {
        const [logsRes, mfaRes] = await Promise.all([
          fetch('/api/auth/activity-logs'),
          fetch('/api/employer-dashboard/security/mfa')
        ]);
        
        if (logsRes.ok) {
          const data = await logsRes.json();
          setActivityLogs(data.logs || []);
        }
        
        if (mfaRes.ok) {
          const data = await mfaRes.json();
          setMfaStatus(prev => ({ ...prev, enabled: data.enabled, loading: false }));
          setMfaFactors(Array.isArray(data.factors) ? data.factors : []);
        }
      } catch (err) {
        console.error('Failed to fetch security data:', err);
      } finally {
        setLogsLoading(false);
      }
    };
    
    void fetchSecurityData();
  }, [activeTab]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleMfaToggle = async (enable: boolean) => {
    setMfaStatus(prev => ({ ...prev, loading: true }));
    
    try {
      if (enable) {
        const res = await fetch('/api/employer-dashboard/security/mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enable' }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setMfaStatus({
            enabled: false,
            loading: false,
            showSetup: true,
            qrCode: data.qrCode,
            factorId: data.factorId
          });
          toast.success('Scan the QR code to continue');
        } else {
          const error = await res.json();
          toast.error(error.error || 'Failed to initialize MFA');
          setMfaStatus(prev => ({ ...prev, loading: false }));
        }
      } else {
        const res = await fetch('/api/employer-dashboard/security/mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'disable' }),
        });
        
        if (res.ok) {
          setMfaStatus({ enabled: false, loading: false, showSetup: false, qrCode: '', factorId: '' });
          setMfaFactors([]);
          toast.success('MFA disabled');
        } else {
          const error = await res.json();
          toast.error(error.error || 'Failed to disable MFA');
          setMfaStatus(prev => ({ ...prev, loading: false }));
        }
      }
    } catch {
      toast.error('MFA update failed');
      setMfaStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleMfaVerify = async () => {
    if (!verificationCode || !mfaStatus.factorId) return;
    setMfaStatus(prev => ({ ...prev, loading: true }));
    
    try {
      const res = await fetch('/api/employer-dashboard/security/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'verify', 
          factorId: mfaStatus.factorId,
          code: verificationCode 
        }),
      });
      
      if (res.ok) {
        setMfaStatus({ enabled: true, loading: false, showSetup: false, qrCode: '', factorId: '' });
        setVerificationCode('');
        const statusRes = await fetch('/api/employer-dashboard/security/mfa');
        if (statusRes.ok) {
          const data = await statusRes.json();
          setMfaFactors(data.factors || []);
        }
        toast.success('MFA enabled successfully');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Invalid code');
        setMfaStatus(prev => ({ ...prev, loading: false }));
      }
    } catch {
      toast.error('Verification failed');
      setMfaStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDisableFactor = async (factorId: string) => {
    try {
      const res = await fetch('/api/employer-dashboard/security/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', factorId }),
      });
      if (res.ok) {
        toast.success('Authenticator removed');
        const statusRes = await fetch('/api/employer-dashboard/security/mfa');
        if (statusRes.ok) {
          const data = await statusRes.json();
          setMfaStatus(prev => ({ ...prev, enabled: data.enabled }));
          setMfaFactors(data.factors || []);
        }
      }
    } catch {
      toast.error('Failed to remove authenticator');
    }
  };

  const handleGenerateBackupCodes = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/employer-dashboard/security/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_backup_codes' }),
      });
      if (res.ok) {
        const data = await res.json();
        setBackupCodes(data.backupCodes || []);
        setShowMfaModal(true);
        toast.success('Backup codes generated');
      }
    } finally {
      setBackupLoading(false);
    }
  };

  const handleFileUpload = async (file: File, docKey: string) => {
    setUploadingDoc(docKey);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", docKey);

      const res = await fetch("/api/employer-dashboard/settings/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(await getResponseErrorMessage(res, "Failed to upload document"));

      const data = await res.json();
      setEmployer((prev) => prev ? {
        ...prev,
        documents: { ...prev.documents, [docKey]: data.fileUrl },
      } : prev);

      toast.success(`${docKey.replace(/_/g, ' ')} uploaded successfully!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/employer-dashboard/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        toast.success("Profile saved successfully");
      } else {
        toast.error(await getResponseErrorMessage(res, "Failed to save profile"));
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleBankChangeRequest = async (data: { bank_name: string; bank_account_number: string; reason: string }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/employer-dashboard/settings/bank-change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Bank change request sent successfully");
        setShowBankModal(false);
      } else {
        toast.error(await getResponseErrorMessage(res, "Failed to send bank change request"));
      }
    } catch (err) {
      console.error("Failed to send bank change request:", err);
      toast.error("Failed to send bank change request");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setUpdatingPassword(true);
    try {
      const res = await fetch("/api/employer-dashboard/security/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: passwordForm.newPassword }),
      });
      if (res.ok) {
        toast.success("Password updated successfully");
        setPasswordForm({ newPassword: '', confirmPassword: '' });
      } else {
        toast.error(await getResponseErrorMessage(res, "Failed to update password"));
      }
    } catch (err) {
      console.error("Password update error:", err);
      toast.error("Failed to update password");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleTerminateAccount = async () => {
    const confirmed = window.confirm(
      "Are you absolutely sure? This will disable all employee access and hide your organization data. You will have 30 days to restore it."
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/employer-dashboard/termination/terminate', { method: 'POST' });
      if (res.ok) {
        toast.success("Your account has been terminated.");
        
        // Sign out and redirect to login (NOT onboarding)
        await logout();
        router.push('/login');
      } else {
        toast.error("Failed to terminate account");
      }
    } catch {
      toast.error("Failed to terminate account");
    } finally {
      setSaving(false);
    }
  };

  // ─── Config ───────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'account', label: 'Profile', icon: User },
    { id: 'company', label: 'Company Info', icon: Building2 },
    { id: 'kyc', label: 'KYC & Documents', icon: FileText },
    { id: 'ewa', label: 'EWA Settings', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'help', label: 'Help Centre', icon: HelpCircle },
    { id: 'terms', label: 'Terms & Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  const documents: Array<{
    key: string;
    label: string;
    statusOverride?: 'approved' | 'pending';
  }> = [
    { key: 'certificate_of_incorporation', label: 'Certificate of Incorporation' },
    { key: 'kra_pin_certificate', label: 'KRA PIN Certificate' },
    { key: 'cr12_document', label: 'CR12 Document', statusOverride: 'pending' },
    { key: 'business_permit', label: 'Business Permit' },
    { key: 'audited_financials', label: 'Audited Financials', statusOverride: 'pending' },
    { key: 'employment_contract_template', label: 'Employment Contract Template' },
  ];

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <EmployerPortalLayout employer={employer}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployerPortalLayout>
    );
  }

  const currencySymbol = getCurrencySymbol(getCurrencyFromCountry(employer?.country));
  const advanceLimit = getAdvanceLimit(employer?.country);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="settings-title">
              Settings
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage your company settings and EWA program configuration
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="save-settings-btn"
            className="bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl transition-shadow"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-3 border border-slate-200/50 dark:border-slate-700/30 space-y-2">
              {tabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  active={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  icon={tab.icon}
                  label={tab.label}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3 space-y-6">

            {/* ── Account ── */}
            {activeTab === 'account' && (
              <EmployerProfileTab
                employerId={employer?.id}
                fullName={employer?.full_name || employer?.contact_person}
                email={employer?.contact_email}
                avatarUrl={employer?.avatar_url}
              />
            )}

            {/* ── Company ── */}
            {activeTab === 'company' && (
              <>
                <SettingsCard icon={Building2} title="Company Information" description="Update your company details">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Company Name</Label>
                      <Input
                        value={profile.companyName}
                        readOnly
                        className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                        data-testid="company-name-input"
                      />
                      <p className="text-xs text-slate-500">Contact support to change company name</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Payroll Cycle</Label>
                      <Input
                        value={PAYROLL_CYCLE_LABELS[profile.payrollCycle] || profile.payrollCycle}
                        readOnly
                        className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed capitalize"
                        data-testid="payroll-cycle-select"
                      />
                      <p className="text-xs text-slate-500">Contact support to change payroll cycle</p>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-linear-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 rounded-xl border border-primary/20">
                    <Label className="text-slate-700 dark:text-slate-300 text-sm">Employer Code</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <code className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg font-mono text-lg font-bold text-primary border border-primary/30">
                        {employer?.company_code || `EW-${employer?.id?.slice(0, 8).toUpperCase() || 'XXXXXXXX'}`}
                      </code>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Unique identifier assigned upon registration</span>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard icon={MapPin} title="Business Address" description="Your company's physical address">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Physical Address</Label>
                      <Input
                        value={profile.physicalAddress}
                        readOnly
                        placeholder="Street address, building name"
                        className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                        data-testid="physical-address-input"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">City</Label>
                        <Input value={profile.city} readOnly placeholder="Nairobi" className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed" data-testid="city-input" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Postal Code</Label>
                        <Input value={profile.postalCode} readOnly placeholder="00100" className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed" data-testid="postal-code-input" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">County/Region</Label>
                        <Input value={profile.countyRegion} readOnly placeholder="Your county or region" className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed" data-testid="county-input" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Country</Label>
                        <Input value={COUNTRY_LABELS[profile.country] || profile.country} readOnly className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed" data-testid="country-input" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Contact support to change your business address</p>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Users} title="Primary Contact" description="Who should we contact about EWA matters?">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Contact Person</Label>
                      <Input value={profile.contactPerson} readOnly placeholder="Full name" className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed" data-testid="contact-person-input" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Phone Number</Label>
                      <Input value={profile.contactPhone} readOnly placeholder="+254 700 000 000" className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed" data-testid="contact-phone-input" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-slate-700 dark:text-slate-300">Email Address</Label>
                      <Input type="email" value={profile.contactEmail} readOnly placeholder="email@company.com" className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed" data-testid="contact-email-input" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-4">Contact support to change your primary contact information</p>
                </SettingsCard>

                {/* Verification status banner */}
                <div className={cn(
                  "rounded-2xl p-6 border",
                  employer?.status === 'approved'
                    ? "bg-linear-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20"
                    : "bg-linear-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center",
                      employer?.status === 'approved'
                        ? "bg-emerald-100 dark:bg-emerald-500/20"
                        : "bg-amber-100 dark:bg-amber-500/20"
                    )}>
                      {employer?.status === 'approved'
                        ? <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                        : <Clock className="w-7 h-7 text-amber-600" />
                      }
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        Verification Status:{' '}
                        {(employer?.status ?? 'pending').charAt(0).toUpperCase() + (employer?.status ?? 'pending').slice(1)}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {employer?.status === 'approved'
                          ? 'Your company is fully verified and can access all EaziWage features.'
                          : 'Your company verification is in progress. Some features may be limited until approval.'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── KYC ── */}
            {activeTab === 'kyc' && (
              <>
                <SettingsCard icon={FileText} title="Company Documents" description="View and manage your uploaded KYC documents">
                  <div className="space-y-3">
                    {documents.map(({ key, label, statusOverride }) => {
                      const url = employer?.documents?.[key];
                      const status = url ? (statusOverride ?? 'approved') : null;
                      return (
                        <DocumentItem
                          key={key}
                          icon={FileText}
                          label={label}
                          fileName={url ? `${key}.pdf` : null}
                          status={status}
                          onReupload={(file) => handleFileUpload(file, key)}
                          isUploading={uploadingDoc === key}
                          onView={() => url && window.open(url, '_blank')}
                        />
                      );
                    })}
                  </div>
                </SettingsCard>

                <SettingsCard icon={Wallet} title="Bank Account Details" description="Your linked bank account for settlements" locked>
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Bank Name</Label>
                        <Input value={employer?.bank_name || ''} disabled className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Account Number</Label>
                        <Input
                          value={employer?.bank_account_number ? `****${employer.bank_account_number.slice(-4)}` : ''}
                          disabled
                          className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
                        Bank account changes require approval from EaziWage for security purposes.
                      </p>
                      <button
                        onClick={() => setShowBankModal(true)}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-amber-300 text-amber-700 hover:bg-amber-100 h-9 px-3 transition-colors"
                      >
                        Request Change
                      </button>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Building2} title="Business Information" description="Registered company details">
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Registration Number</Label>
                        <Input value={employer?.registration_number || ''} disabled className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Tax ID (KRA PIN)</Label>
                        <Input value={employer?.tax_id || ''} disabled className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Industry</Label>
                        <Input value={employer?.industry?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || ''} disabled className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Sector</Label>
                        <Input value={employer?.sector?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || ''} disabled className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">To update registration details, please contact support.</p>
                  </div>
                </SettingsCard>
              </>
            )}

            {/* ── EWA ── */}
            {activeTab === 'ewa' && (
              <>
                <SettingsCard icon={Percent} title="Advance Limits" description="Control how much employees can advance">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-700 dark:text-slate-300">Maximum Advance Percentage</Label>
                        <span className="text-2xl font-bold text-primary">{settings.maxAdvancePercentage}%</span>
                      </div>
                      <Slider
                        value={[settings.maxAdvancePercentage]}
                        onValueChange={(v) => {
                          const val = Math.min(v[0], advanceLimit);
                          setSettings((prev) => ({ ...prev, maxAdvancePercentage: val }));
                        }}
                        max={advanceLimit}
                        min={10}
                        step={5}
                        className="w-full"
                        data-testid="max-advance-slider"
                      />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Employees can advance up to {settings.maxAdvancePercentage}% of their earned wages.
                        <span className="block mt-1 font-medium text-amber-600">
                          (Statutory limit for {employer?.country || 'your country'}: {advanceLimit}%)
                        </span>
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/30">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Minimum Amount ({currencySymbol})</Label>
                        <Input
                          type="number"
                          value={settings.minAdvanceAmount}
                          onChange={(e) => setSettings((prev) => ({ ...prev, minAdvanceAmount: parseInt(e.target.value) || 0 }))}
                          className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                          data-testid="min-advance-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Maximum Amount ({currencySymbol})</Label>
                        <Input
                          type="number"
                          value={settings.maxAdvanceAmount}
                          onChange={(e) => setSettings((prev) => ({ ...prev, maxAdvanceAmount: parseInt(e.target.value) || 0 }))}
                          className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                          data-testid="max-advance-input"
                        />
                      </div>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Calendar} title="Access Period" description="When can employees request advances?">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-slate-700 dark:text-slate-300">Advance Access Window</Label>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <span className="text-sm text-slate-500 dark:text-slate-400">From Day</span>
                          <Select
                            value={settings.advanceAccessDays[0].toString()}
                            onValueChange={(v) => setSettings((prev) => ({
                              ...prev,
                              advanceAccessDays: [parseInt(v), prev.advanceAccessDays[1]],
                            }))}
                          >
                            <SelectTrigger className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                                <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <span className="text-sm text-slate-500 dark:text-slate-400">To Day</span>
                          <Select
                            value={settings.advanceAccessDays[1].toString()}
                            onValueChange={(v) => setSettings((prev) => ({
                              ...prev,
                              advanceAccessDays: [prev.advanceAccessDays[0], parseInt(v)],
                            }))}
                          >
                            <SelectTrigger className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                                <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Employees can request advances from day {settings.advanceAccessDays[0]} to {settings.advanceAccessDays[1]} of each month
                      </p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/30">
                      <Label className="text-slate-700 dark:text-slate-300">Cooldown Period (Days)</Label>
                      <Input
                        type="number"
                        value={settings.cooldownPeriod}
                        onChange={(e) => setSettings((prev) => ({ ...prev, cooldownPeriod: parseInt(e.target.value) || 0 }))}
                        min={0}
                        max={30}
                        className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 max-w-xs"
                        data-testid="cooldown-input"
                      />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Minimum {settings.cooldownPeriod} days between advance requests per employee
                      </p>
                    </div>
                  </div>
                </SettingsCard>

                <div className="bg-linear-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-2xl p-6 border border-blue-500/20">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200">Per-Employee Settings</h3>
                      <p className="text-sm text-blue-800 dark:text-blue-300/80 mt-1">
                        You can override these default settings for individual employees. Go to Employees {'>'} Select Employee {'>'} EWA Settings to customize limits per employee.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Notifications ── */}
            {activeTab === 'notifications' && (
              <SettingsCard icon={Bell} title="Notification Preferences" description="Choose what updates you want to receive">
                <div className="space-y-4">
                  <ToggleItem
                    icon={Mail}
                    label="Email Notifications"
                    description="Receive important updates via email"
                    checked={settings.emailNotifications}
                    onToggle={(v) => {
                      setSettings((prev) => ({ ...prev, emailNotifications: v }));
                      toast.success(v ? 'Email notifications enabled' : 'Email notifications disabled');
                    }}
                  />
                  <ToggleItem
                    icon={CreditCard}
                    label="Advance Alerts"
                    description="Get notified when employees request advances"
                    checked={settings.advanceAlerts}
                    onToggle={(v) => {
                      setSettings((prev) => ({ ...prev, advanceAlerts: v }));
                      toast.success(v ? 'Advance alerts enabled' : 'Advance alerts disabled');
                    }}
                  />
                  <ToggleItem
                    icon={Calendar}
                    label="Payroll Reminders"
                    description="Reminders to upload monthly payroll data"
                    checked={settings.payrollReminders}
                    onToggle={(v) => {
                      setSettings((prev) => ({ ...prev, payrollReminders: v }));
                      toast.success(v ? 'Payroll reminders enabled' : 'Payroll reminders disabled');
                    }}
                  />
                  <ToggleItem
                    icon={BarChart3}
                    label="Weekly Reports"
                    description="Receive weekly summary reports via email"
                    checked={settings.weeklyReports}
                    onToggle={(v) => {
                      setSettings((prev) => ({ ...prev, weeklyReports: v }));
                      toast.success(v ? 'Weekly reports enabled' : 'Weekly reports disabled');
                    }}
                  />
                </div>
              </SettingsCard>
            )}

            {/* ── Help ── */}
            {activeTab === 'help' && (
              <>
                <SettingsCard icon={HelpCircle} title="Frequently Asked Questions" description="Quick answers to common questions">
                  <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
                    {faqItems.map((item, index) => (
                      <FAQItem key={index} question={item.question} answer={item.answer} />
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard icon={MessageSquare} title="Contact Support" description="Get in touch with our team">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                          <Mail className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Email Support</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">support@eaziwage.com</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                          <Phone className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Phone Support</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">+254 723 154 900</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Globe} title="Resources" description="Helpful documentation and guides">
                  <div className="space-y-3">
                    {[
                      { label: 'Employer Guide', description: 'Complete setup and usage guide' },
                      { label: 'API Documentation', description: 'For payroll integration' },
                    ].map(({ label, description }) => (
                      <a
                        key={label}
                        href="#"
                        className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{label}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                          </div>
                        </div>
                        <ExternalLink className="w-5 h-5 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </SettingsCard>
              </>
            )}

            {/* ── Terms ── */}
            {activeTab === 'terms' && (
              <>
                <SettingsCard icon={FileText} title="Terms of Service" description="Your agreement with EaziWage">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    By using EaziWage services, you agree to our Terms of Service which govern the relationship between your company and EaziWage Ltd.
                  </p>
                  <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl max-h-48 overflow-y-auto text-xs text-slate-500 dark:text-slate-400 space-y-3">
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">1. Service Agreement</h4>
                      <p>EaziWage provides earned wage access services to employers and their employees. By registering, you agree to facilitate wage advances to your employees through our platform.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">2. Employer Obligations</h4>
                      <p>As an employer, you agree to: (a) Provide accurate payroll data; (b) Deduct advances from employee salaries; (c) Maintain employee consent records; (d) Comply with local labor laws.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">3. Fees and Charges</h4>
                      <p>Fees are calculated based on risk assessment and disclosed to employees before each advance. Employers are not charged for the service.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">4. Termination</h4>
                      <p>Either party may terminate with 30 days notice. Outstanding advances must be settled before termination.</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <a href="/terms.pdf" download className="block">
                      <button className="w-full inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-sm font-medium transition-colors">
                        <Download className="w-4 h-4 mr-2" /> Download PDF
                      </button>
                    </a>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Shield} title="Privacy Policy" description="How we handle your data">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    EaziWage is committed to protecting your privacy and the privacy of your employees.
                  </p>
                  <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl max-h-48 overflow-y-auto text-xs text-slate-500 dark:text-slate-400 space-y-3">
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Data We Collect</h4>
                      <p>Company registration details, employee information (name, ID, salary), bank account details, transaction history.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">How We Use Data</h4>
                      <p>To provide wage access services, verify identities, calculate risk scores, process payments, and comply with regulations.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Data Protection</h4>
                      <p>All data is encrypted at rest and in transit. We comply with Kenya&apos;s Data Protection Act 2019 and international standards.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Data Sharing</h4>
                      <p>We do not sell data. Data may be shared with: payment processors, regulatory authorities (as required), and service providers under contract.</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <a href="/data.pdf" download className="block">
                      <button className="w-full inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-sm font-medium transition-colors">
                        <Download className="w-4 h-4 mr-2" /> Download PDF
                      </button>
                    </a>
                  </div>
                </SettingsCard>
              </>
            )}

            {/* ── Security ── */}
            {activeTab === 'security' && (
              <>
                <SettingsCard icon={Shield} title="Multi-Factor Authentication" description="Add an extra layer of security to your account">
                  {mfaStatus.showSetup ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                        </p>
                        {mfaStatus.qrCode && (
                          <div 
                            className="w-48 h-48 mx-auto bg-white p-4 rounded-xl border border-slate-200"
                            dangerouslySetInnerHTML={{ __html: mfaStatus.qrCode }}
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Verification Code</Label>
                        <Input 
                          type="text" 
                          placeholder="Enter 6-digit code"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleMfaVerify}
                          disabled={mfaStatus.loading || verificationCode.length !== 6}
                          className="bg-primary text-white"
                        >
                          {mfaStatus.loading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Verifying...
                            </div>
                          ) : (
                            'Enable MFA'
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setMfaStatus(prev => ({ ...prev, showSetup: false, loading: false }));
                            setVerificationCode('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ToggleItem 
                        icon={Smartphone}
                        label="Authenticator App (TOTP)"
                        description="Use an app like Google Authenticator or Authy"
                        checked={mfaStatus.enabled}
                        onToggle={(checked: boolean) => handleMfaToggle(checked)}
                      />
                      {mfaStatus.enabled && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowMfaModal(true)}>Manage MFA</Button>
                        </div>
                      )}
                    </div>
                  )}
                </SettingsCard>

                <SettingsCard icon={History} title="Login History & Activity" description="Recent security-related events for your account">
                  {logsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No recent security events.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                      {activityLogs.map((log, idx) => (
                        <div key={idx} className="py-3 flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                              {log.action.replace('_', ' ')}
                            </p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                            {log.metadata && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                {log.metadata.device_name && `Device: ${log.metadata.device_name}`}
                                {log.metadata.location && ` • Location: ${log.metadata.location}`}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded uppercase tracking-widest ml-3">
                            {log.metadata?.ip || 'Verified'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </SettingsCard>

                <SettingsCard icon={Lock} title="Password" description="Update your account password">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Current Password</Label>
                      <Input
                        type="password"
                        placeholder="Enter current password"
                        className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                        data-testid="current-password"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">New Password</Label>
                        <Input
                          type="password"
                          placeholder="Enter new password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                          className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                          data-testid="new-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Confirm Password</Label>
                        <Input
                          type="password"
                          placeholder="Confirm new password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                          className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                          data-testid="confirm-password"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handlePasswordUpdate}
                      disabled={updatingPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                      className="bg-primary text-white"
                      data-testid="update-password-btn"
                    >
                      {updatingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </SettingsCard>

                {/* Danger Zone */}
                <div className="pt-8 mt-8 border-t border-red-500/20">
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-900/30 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 space-y-2 text-center md:text-left">
                      <h3 className="text-xl font-bold text-red-600 dark:text-red-400">Danger Zone</h3>
                      <p className="text-sm text-red-700/70 dark:text-red-400/60 max-w-md">
                        Terminating your account will disable all employee access and hide your data. You will have 30 days to restore your account before permanent deletion.
                      </p>
                    </div>
                    <Button
                      onClick={handleTerminateAccount}
                      disabled={saving}
                      className="bg-red-600 hover:bg-red-700 text-white h-12 px-8 rounded-xl font-bold shadow-xl shadow-red-600/20"
                    >
                      Delete Account
                    </Button>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>

      <BankChangeModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        onSubmit={handleBankChangeRequest}
        isSubmitting={saving}
      />

      {/* MFA Manager Modal */}
      {showMfaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Manage MFA & Backup Codes</h3>
                  <p className="text-sm text-slate-500">View and remove registered authenticators. Generate one-time backup codes.</p>
                </div>
              </div>
              <button onClick={() => { setShowMfaModal(false); setBackupCodes(null); }} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Registered Authenticators</h4>
              {mfaFactors.length === 0 ? (
                <p className="text-sm text-slate-500">No authenticators found.</p>
              ) : (
                <div className="space-y-2">
                  {mfaFactors.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-medium text-sm text-slate-900 dark:text-white">{f.friendly_name || f.factor_type}</p>
                        <p className="text-[10px] text-slate-400">{f.created_at ? new Date(f.created_at).toLocaleString() : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleDisableFactor(f.id)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Backup Codes</h4>
                {backupCodes ? (
                  <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Save these codes somewhere safe — each code can be used once to sign in if you lose access to your authenticator.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((c, idx) => (
                        <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-md text-xs font-mono flex items-center justify-between">
                          <span>{c}</span>
                          <button onClick={() => { if (typeof navigator !== 'undefined') void navigator.clipboard.writeText(c); toast.success('Copied!'); }} className="ml-2 text-xs text-primary">Copy</button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button onClick={() => { setBackupCodes(null); setShowMfaModal(false); }} className="bg-primary text-white">Done</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button onClick={handleGenerateBackupCodes} disabled={backupLoading} className="bg-primary text-white">{backupLoading ? 'Generating...' : 'Generate Backup Codes'}</Button>
                    <Button variant="outline" onClick={() => setShowMfaModal(false)}>Close</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </EmployerPortalLayout>
  );
}